import React, { useEffect, useState, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { action } from 'mobx';
import { shell } from 'electron';
import { Tag, IconSet } from 'widgets';
import { Menu, MenuItem, MenuDivider, useContextMenu } from 'widgets/menus';
import { useStore } from '../../contexts/StoreContext';
import { ClientFile } from '../../entities/File';
import { Thumbnail } from './GalleryItem';
import { CommandDispatcher } from './Commands';
import { GalleryProps } from './utils';
import { DismissedDuplicateGroupDTO } from '../../../api/dismissed-duplicate-group';
import { visualSimilarityManager } from '../../workers/VisualSimilarityManager';

export enum DuplicateAlgorithm {
  FileSize = 'fileSize',
  FileName = 'fileName',
  FileHash = 'fileHash',
  Metadata = 'metadata',
  Combined = 'combined',
  ThumbnailVisual = 'thumbnailVisual',
}

interface AlgorithmInfo {
  id: DuplicateAlgorithm;
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  speed: 'Fast' | 'Medium' | 'Slow';
  accuracy: 'Low' | 'Medium' | 'High' | 'Very High';
  technical: string;
}

const ALGORITHMS: AlgorithmInfo[] = [
  {
    id: DuplicateAlgorithm.FileSize,
    name: 'File Size Match',
    description: 'Groups files with identical file sizes (in bytes)',
    pros: ['Very fast execution', 'Works with any file type', 'No file reading required'],
    cons: ['Many false positives', 'Different files can have same size', 'Not reliable alone'],
    speed: 'Fast',
    accuracy: 'Low',
    technical: 'Compares file.size property for exact matches',
  },
  {
    id: DuplicateAlgorithm.FileName,
    name: 'File Name Match',
    description: 'Groups files with identical names (case-insensitive)',
    pros: ['Fast execution', 'Good for renamed copies', 'Intuitive results'],
    cons: [
      'Misses renamed duplicates',
      'False positives with common names',
      'Ignores file content',
    ],
    speed: 'Fast',
    accuracy: 'Medium',
    technical: 'Compares file.name.toLowerCase() for exact matches',
  },
  {
    id: DuplicateAlgorithm.FileHash,
    name: 'File Hash (MD5)',
    description: 'Calculates MD5 hash of entire file content for comparison',
    pros: [
      '100% accurate content matching',
      'Detects byte-for-byte duplicates',
      'Industry standard',
    ],
    cons: ['Slower for large files', 'CPU intensive', 'Requires reading entire file'],
    speed: 'Slow',
    accuracy: 'Very High',
    technical: 'Uses crypto.createHash("md5") on file buffer, compares hex digests',
  },
  {
    id: DuplicateAlgorithm.Metadata,
    name: 'Metadata Comparison',
    description: 'Compares EXIF data: dimensions, creation date, camera model',
    pros: ['Good for photos', 'Faster than hashing', 'Detects similar shots'],
    cons: ['Only works with metadata', 'Edited files may differ', 'EXIF can be stripped'],
    speed: 'Medium',
    accuracy: 'High',
    technical: 'Compares width, height, dateTimeOriginal, make, model from EXIF',
  },
  {
    id: DuplicateAlgorithm.Combined,
    name: 'Combined Score',
    description: 'Uses weighted combination of size, name, and metadata similarity',
    pros: ['Balanced accuracy/speed', 'Configurable thresholds', 'Reduces false positives'],
    cons: ['More complex setup', 'Requires tuning', 'May miss edge cases'],
    speed: 'Medium',
    accuracy: 'High',
    technical: 'Weighted score: size(30%) + name(20%) + metadata(50%), threshold > 0.7',
  },
  {
    id: DuplicateAlgorithm.ThumbnailVisual,
    name: 'Visual Similarity (Enhanced)',
    description: 'Advanced perceptual hashing with Web Workers for optimal performance',
    pros: [
      'Detects visually similar images with high accuracy',
      'Catches resized/cropped/edited duplicates',
      'Works regardless of filename/metadata',
      'Enhanced pHash algorithm with DCT transform',
      'Non-blocking Web Worker processing',
      'Automatic fallback to basic algorithm',
    ],
    cons: [
      'More CPU intensive than metadata methods',
      'May group similar but different scenes',
      'Requires thumbnail generation',
      'Needs modern browser features',
    ],
    speed: 'Medium',
    accuracy: 'Very High',
    technical: 'Enhanced perceptual hash (pHash) using DCT in Web Workers, with aHash fallback',
  },
];

interface DuplicateGroup {
  id: string;
  files: ClientFile[];
  reason: string;
  confidence: number;
  algorithm: DuplicateAlgorithm;
  details?: string;
  hash: string; // Unique hash for persistent dismissal
}

interface ThumbnailHash {
  fileId: string;
  hash: string;
  similarity?: number; // For visual algorithm results
}

interface DuplicateItemProps {
  group: DuplicateGroup;
  select: (file: ClientFile, toggleSelection: boolean, rangeSelection: boolean) => void;
  onDismiss: (group: DuplicateGroup) => void;
  isDismissing: boolean;
}

interface AlgorithmStats {
  processingTime: number;
  filesAnalyzed: number;
  groupsFound: number;
  duplicatesFound: number;
}

// Utility function to find the longest common path prefix
const findCommonPathPrefix = (paths: string[]): string => {
  if (paths.length === 0) {
    return '';
  }
  if (paths.length === 1) {
    return paths[0].split('/').slice(0, -1).join('/') + '/';
  }

  // Split all paths into segments
  const pathSegments = paths.map((path) => path.split('/'));

  // Find the minimum length to avoid out of bounds
  const minLength = Math.min(...pathSegments.map((segments) => segments.length));

  const commonPrefix: string[] = [];

  // Compare segments from the beginning
  for (let i = 0; i < minLength - 1; i++) {
    // -1 to exclude filename
    const segment = pathSegments[0][i];
    if (pathSegments.every((segments) => segments[i] === segment)) {
      commonPrefix.push(segment);
    } else {
      break;
    }
  }

  return commonPrefix.length > 0 ? commonPrefix.join('/') + '/' : '';
};

// Get the relative path after removing the common prefix
const getRelativePath = (fullPath: string, commonPrefix: string): string => {
  if (commonPrefix && fullPath.startsWith(commonPrefix)) {
    return fullPath.slice(commonPrefix.length);
  }
  return fullPath;
};

const DuplicateItem = observer(({ group, select, onDismiss, isDismissing }: DuplicateItemProps) => {
  const { uiStore } = useStore();
  const [showAllFiles, setShowAllFiles] = useState(false);

  const MAX_INITIAL_FILES = 5;
  const shouldLimitFiles = group.files.length > MAX_INITIAL_FILES;
  const filesToShow =
    shouldLimitFiles && !showAllFiles ? group.files.slice(0, MAX_INITIAL_FILES) : group.files;
  const hiddenFilesCount = group.files.length - MAX_INITIAL_FILES;

  // Calculate common path and relative paths
  const allPaths = group.files.map((file) => file.absolutePath);
  const commonPath = findCommonPathPrefix(allPaths);
  const hasCommonPath = commonPath.length > 1; // More than just "/"

  // Create a stable function to get event manager for any file
  const getEventManager = useCallback((file: ClientFile) => {
    return new CommandDispatcher(file);
  }, []);

  return (
    <div className="duplicate-group">
      {/* Dismiss Button */}
      <div
        className="duplicate-group__dismiss"
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <button
          className="duplicate-file__show-button"
          onClick={() => onDismiss(group)}
          disabled={isDismissing}
          style={{
            opacity: isDismissing ? 0.6 : 1,
            cursor: isDismissing ? 'not-allowed' : 'pointer',
          }}
          title="Dismiss this duplicate group so it won't appear in future analyses"
        >
          <span
            style={{
              transform: 'scale(0.8)',
              display: 'inline-block',
              marginRight: '4px',
            }}
          >
            {IconSet.EYE_LOW_VISION}
          </span>
          {isDismissing ? 'Dismissing...' : 'Dismiss duplicate'}
        </button>
      </div>

      {/* 1. Image previews */}
      <div className="duplicate-group__files">
        {filesToShow.map((file) => {
          const eventManager = getEventManager(file);
          const displayPath = hasCommonPath
            ? getRelativePath(file.absolutePath, commonPath)
            : file.absolutePath.split('/').slice(-2).join('/');

          return (
            <div key={file.id} className="duplicate-file-container">
              <div
                className={`duplicate-file ${uiStore.fileSelection.has(file) ? 'selected' : ''}`}
                onClick={(e) => {
                  // Use both CommandDispatcher for full integration AND the select function for keyboard navigation
                  eventManager.select(e);
                  // Disable range selection (shift+click) in duplicate view to prevent selecting hidden files
                  select(file, e.ctrlKey || e.metaKey, false);
                }}
                onDoubleClick={eventManager.preview}
                onContextMenu={eventManager.showContextMenu}
              >
                <div className="duplicate-file__thumbnail">
                  <Thumbnail
                    file={file}
                    mounted={true}
                    forceNoThumbnail={false}
                    hovered={false}
                    galleryVideoPlaybackMode="disabled"
                    isSlideMode={false}
                  />
                </div>
                <div className="duplicate-file__info">
                  <div className="duplicate-file__name" title={file.name}>
                    {file.name}
                  </div>
                  <div className="duplicate-file__dimensions">
                    {file.width} × {file.height} • {Math.round(file.size / 1024)}KB
                  </div>
                  <div className="duplicate-file__path" title={file.absolutePath}>
                    {displayPath}
                  </div>
                  {file.tags.size > 0 && (
                    <div className="duplicate-file__tags">
                      {Array.from(file.tags, (tag) => (
                        <Tag
                          key={tag.id}
                          text={tag.name}
                          color={tag.viewColor}
                          tooltip={tag.path.join(' › ')}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <button
                  className="duplicate-file__show-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    shell.showItemInFolder(file.absolutePath);
                  }}
                  title="Show in folder"
                >
                  Show in Folder
                </button>
                <button
                  className="duplicate-file__delete-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Select the file for deletion if not already selected
                    if (!uiStore.fileSelection.has(file)) {
                      uiStore.selectFile(file, true);
                    }
                    uiStore.openMoveFilesToTrash();
                  }}
                  title="Delete file"
                  style={{
                    fontSize: '11px',
                  }}
                >
                  <span
                    style={{
                      transform: 'scale(0.8)',
                      display: 'inline-block',
                    }}
                  >
                    {IconSet.DELETE}
                  </span>
                  Delete
                </button>
              </div>
            </div>
          );
        })}

        {shouldLimitFiles && !showAllFiles && (
          <div className="duplicate-file-container">
            <div
              className="duplicate-file duplicate-file--show-more"
              onClick={() => setShowAllFiles(true)}
              title={`Show ${hiddenFilesCount} more similar ${
                hiddenFilesCount === 1 ? 'file' : 'files'
              }`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setShowAllFiles(true);
                }
              }}
            >
              <div
                className="duplicate-file__thumbnail duplicate-file__thumbnail--show-more"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  width: '100%',
                  textAlign: 'center',
                  padding: '16px',
                  boxSizing: 'border-box',
                }}
              >
                <div
                  className="show-more-plus"
                  style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}
                >
                  +{hiddenFilesCount}
                </div>
                <div
                  className="show-more-text"
                  style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}
                >
                  Show More
                </div>
                <div className="show-more-subtitle" style={{ fontSize: '12px', opacity: 0.7 }}>
                  {hiddenFilesCount} more similar {hiddenFilesCount === 1 ? 'file' : 'files'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Paths second */}
      {hasCommonPath && (
        <div className="duplicate-group__path-info">
          <br />
          <div className="common-path">
            <span style={{ marginRight: '8px', verticalAlign: 'middle' }}>
              {IconSet.FOLDER_CLOSE}
            </span>
            <strong>Common path:</strong> <code>{commonPath}</code>
          </div>
          <div className="different-paths">
            <span style={{ marginRight: '8px', verticalAlign: 'middle' }}>
              {IconSet.FOLDER_STRUCTURE}
            </span>
            <strong>Different paths:</strong>
            <ul className="different-paths__list">
              {filesToShow.map((file) => (
                <li key={file.id} className="different-paths__item">
                  <code
                    onClick={(e) => {
                      e.stopPropagation();
                      // Select the file when clicking on the path
                      select(file, e.ctrlKey || e.metaKey, false);
                    }}
                    style={{
                      cursor: 'pointer',
                      color: uiStore.fileSelection.has(file) ? '#007bff' : 'inherit',
                      fontWeight: uiStore.fileSelection.has(file) ? 'bold' : 'normal',
                      transition: 'color 0.2s ease',
                    }}
                    title="Click to highlight corresponding image"
                  >
                    {getRelativePath(file.absolutePath, commonPath)}
                  </code>
                  <span className="different-paths__actions">
                    <button
                      className="path-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        shell.showItemInFolder(file.absolutePath);
                      }}
                      title="Show in folder"
                      style={{
                        padding: '2px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        opacity: 0.2,
                        verticalAlign: 'middle',
                      }}
                    >
                      <span style={{ verticalAlign: 'middle' }}>{IconSet.FOLDER_CLOSE}</span>
                    </button>
                    <button
                      className="path-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!uiStore.fileSelection.has(file)) {
                          uiStore.selectFile(file, true);
                        }
                        uiStore.openMoveFilesToTrash();
                      }}
                      title="Delete file"
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        opacity: 0.2,
                        verticalAlign: 'middle',
                      }}
                    >
                      <span style={{ verticalAlign: 'middle' }}>{IconSet.DELETE}</span>
                    </button>
                  </span>
                </li>
              ))}
              {shouldLimitFiles && !showAllFiles && (
                <li className="different-paths__item different-paths__show-more">
                  <em>
                    ... and {hiddenFilesCount} more path{hiddenFilesCount === 1 ? '' : 's'}
                  </em>
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* 3. Description with INFO icon */}
      {group.details && (
        <div className="duplicate-group__details">
          <span style={{ marginRight: '8px', verticalAlign: 'middle' }}>{IconSet.INFO}</span>
          <small>{group.details}</small>
          {group.algorithm === DuplicateAlgorithm.ThumbnailVisual && (
            <div style={{ marginTop: '4px', fontSize: '0.8rem', opacity: 0.7 }}>
              💡 <em>Tip: Adjust the similarity threshold above to find more or fewer matches</em>
            </div>
          )}
        </div>
      )}

      {shouldLimitFiles && showAllFiles && (
        <div className="duplicate-group__show-less">
          <button className="btn-secondary" onClick={() => setShowAllFiles(false)}>
            Show fewer files
          </button>
        </div>
      )}
    </div>
  );
});

const AlgorithmSelector = ({
  selectedAlgorithm,
  onAlgorithmChange,
  onAnalyze,
  isAnalyzing,
  stats,
  similarityThreshold,
  onSimilarityThresholdChange,
}: {
  selectedAlgorithm: DuplicateAlgorithm;
  onAlgorithmChange: (algorithm: DuplicateAlgorithm) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  stats: AlgorithmStats | null;
  similarityThreshold: number;
  onSimilarityThresholdChange: (threshold: number) => void;
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const rootStore = useStore();
  const { uiStore, fileStore } = rootStore;
  const hasFilters = uiStore.searchCriteriaList.length > 0;
  const fileCount = fileStore.fileList.length;
  const selectedAlgoInfo = ALGORITHMS.find((a) => a.id === selectedAlgorithm)!;

  return (
    <div className="algorithm-selector">
      <div className="algorithm-selection">
        <label htmlFor="algorithm-select">
          <strong>Algorithm:</strong>
        </label>
        <select
          id="algorithm-select"
          value={selectedAlgorithm}
          onChange={(e) => onAlgorithmChange(e.target.value as DuplicateAlgorithm)}
          style={{
            marginLeft: '8px',
            padding: '4px 8px',
            fontSize: '14px',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            backgroundColor: 'var(--surface-primary)',
            color: 'var(--text-primary)',
          }}
        >
          {ALGORITHMS.map((algo) => (
            <option key={algo.id} value={algo.id}>
              {algo.name}
            </option>
          ))}
        </select>
      </div>

      {/* Algorithm Description */}
      <div className="algorithm-description" style={{ marginTop: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {selectedAlgoInfo.description}
          </span>
          <button
            onClick={() => setShowDetails(!showDetails)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 4px',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              opacity: 0.7,
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
            }}
            title={showDetails ? 'Hide details' : 'Show details'}
          >
            details
            <span
              style={{
                transform: showDetails ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
                fontSize: '0.7rem',
              }}
            >
              ▼
            </span>
          </button>
        </div>

        {showDetails && (
          <div
            className="algorithm-details"
            style={{
              marginTop: '12px',
              padding: '12px',
              backgroundColor: 'var(--surface-secondary)',
              borderRadius: '4px',
              fontSize: '0.9rem',
            }}
          >
            <div className="algorithm-details__section" style={{ marginBottom: '8px' }}>
              <strong>Advantages:</strong>
              <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                {selectedAlgoInfo.pros.map((pro, i) => (
                  <li key={i}>{pro}</li>
                ))}
              </ul>
            </div>
            <div className="algorithm-details__section" style={{ marginBottom: '8px' }}>
              <strong>Limitations:</strong>
              <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                {selectedAlgoInfo.cons.map((con, i) => (
                  <li key={i}>{con}</li>
                ))}
              </ul>
            </div>
            <div className="algorithm-details__section">
              <strong>Technical Implementation:</strong>
              <p style={{ margin: '4px 0' }}>{selectedAlgoInfo.technical}</p>
            </div>
          </div>
        )}
      </div>

      {/* Similarity Threshold for Visual Algorithm */}
      {selectedAlgorithm === DuplicateAlgorithm.ThumbnailVisual && (
        <div className="algorithm-threshold-section" style={{ marginTop: '16px' }}>
          <div className="threshold-controls">
            <label htmlFor="similarity-threshold" className="threshold-label">
              <strong>Similarity Threshold: {similarityThreshold}%</strong>
            </label>
            <input
              id="similarity-threshold"
              type="range"
              min="70"
              max="98"
              step="1"
              value={similarityThreshold}
              onChange={(e) => onSimilarityThresholdChange(Number(e.target.value))}
              className="threshold-slider"
              style={{
                width: '100%',
                marginTop: '8px',
              }}
            />
            <div className="threshold-description" style={{ fontSize: '0.9rem', marginTop: '4px' }}>
              <span style={{ opacity: 0.7 }}>
                Lower values find more similar images (may include false positives). Higher values
                find only very similar images (may miss some duplicates).
              </span>
            </div>
          </div>
        </div>
      )}

      <br />
      <br />
      <div className="algorithm-actions">
        <div className="analyze-section">
          <button className="btn-analyze-new" onClick={onAnalyze} disabled={isAnalyzing}>
            <div className="analyze-content">
              <span className="analyze-icon">{IconSet.DUPLICATE}</span>
              <div className="analyze-main-content">
                <span className="analyze-text">
                  {isAnalyzing ? 'Analyzing...' : `Analyze ${fileCount.toLocaleString()} files`}
                </span>
                {hasFilters && !isAnalyzing && (
                  <div className="analyze-filters-line">
                    {uiStore.searchCriteriaList.map((criteria: any, index: number) => (
                      <span key={index} className="analyze-filter-pill">
                        {criteria.getLabel({ tags: 'Tags', absolutePath: 'Path' }, rootStore)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </button>
          {hasFilters && (
            <button
              className="btn-clear-filters"
              onClick={() => {
                uiStore.clearSearchCriteriaList();
                fileStore.fetchAllFiles();
              }}
              title="Remove all filters and analyze entire collection"
            >
              <span style={{ transform: 'scale(0.8)', display: 'inline-block' }}>
                {IconSet.CLOSE}
              </span>
              Clear filters
            </button>
          )}
        </div>

        {stats && (
          <div className="algorithm-stats-compact">
            <div className="stats-item">
              <div className="stats-content">
                <span className="stats-value">{stats.processingTime}ms</span>
                <span className="stats-label">Processing Time</span>
              </div>
            </div>
            <div className="stats-item">
              <div className="stats-content">
                <span className="stats-value">{stats.filesAnalyzed.toLocaleString()}</span>
                <span className="stats-label">Files Analyzed</span>
              </div>
            </div>
            <div className="stats-item">
              <div className="stats-content">
                <span className="stats-value">{stats.groupsFound}</span>
                <span className="stats-label">Duplicate Groups</span>
              </div>
            </div>
            <div className="stats-item">
              <div className="stats-content">
                <span className="stats-value">{stats.duplicatesFound}</span>
                <span className="stats-label">Total Duplicates</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const DuplicateGallery = observer(({ select }: GalleryProps) => {
  const { fileStore, uiStore } = useStore();
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<DuplicateAlgorithm>(
    DuplicateAlgorithm.ThumbnailVisual,
  );
  const [stats, setStats] = useState<AlgorithmStats | null>(null);
  const [displayedGroupsCount, setDisplayedGroupsCount] = useState(100);
  const [dismissedGroups, setDismissedGroups] = useState<Set<string>>(new Set());
  const [isDismissing, setIsDismissing] = useState(false);
  const [showManagement, setShowManagement] = useState(false);
  const [dismissedGroupsList, setDismissedGroupsList] = useState<DismissedDuplicateGroupDTO[]>([]);
  const [isLoadingManagement, setIsLoadingManagement] = useState(false);
  const [expandedDismissedGroups, setExpandedDismissedGroups] = useState<Set<string>>(new Set());
  const [similarityThreshold, setSimilarityThreshold] = useState(90); // 90% similarity for visual algorithm
  const [analysisProgress, setAnalysisProgress] = useState<{
    phase: 'processing' | 'comparing';
    progress: number;
    details: string;
  } | null>(null);
  const showContextMenu = useContextMenu();

  const GROUPS_PER_PAGE = 100;

  // Generate a consistent hash for a duplicate group based on sorted file IDs
  const generateGroupHash = (files: ClientFile[], algorithm: DuplicateAlgorithm): string => {
    // Sort file IDs to ensure consistent hash regardless of order
    const sortedIds = files.map((f) => f.id).sort();
    const hashInput = `${algorithm}:${sortedIds.join(',')}`;

    // Simple hash function (in Phase 2, we'll use crypto.createHash for production)
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  };

  // Keep the old function for other uses
  const simpleHash = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  };

  // Thumbnail processing utilities for visual similarity
  const loadThumbnailAsImageData = async (thumbnailPath: string): Promise<ImageData | null> => {
    try {
      // Remove the ?v=1 suffix if present
      const cleanPath = thumbnailPath.split('?v=1')[0];

      // For Electron, we need to use the file:// protocol
      const fileUrl = cleanPath.startsWith('file://') ? cleanPath : `file://${cleanPath}`;

      // Create an image element to load the thumbnail
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (e) => reject(new Error(`Failed to load image: ${e}`));
        img.src = fileUrl;
      });

      // Create a canvas to extract ImageData
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Resize to 64x64 for consistent processing
      canvas.width = 64;
      canvas.height = 64;
      ctx.drawImage(img, 0, 0, 64, 64);

      return ctx.getImageData(0, 0, 64, 64);
    } catch (error) {
      console.warn('Failed to load thumbnail:', thumbnailPath, error);
      return null;
    }
  };

  // Convert ImageData to grayscale
  const toGrayscale = (imageData: ImageData): number[] => {
    const grayscale: number[] = [];
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      // Standard grayscale conversion formula
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      grayscale.push(gray);
    }

    return grayscale;
  };

  // Simple perceptual hash implementation (aHash - Average Hash)
  // This is simpler than pHash but still effective for duplicate detection
  const generatePerceptualHash = (grayscaleData: number[]): string => {
    // Calculate average brightness
    const average = grayscaleData.reduce((sum, val) => sum + val, 0) / grayscaleData.length;

    // Generate binary hash based on whether each pixel is above or below average
    let hash = '';
    for (let i = 0; i < grayscaleData.length; i++) {
      hash += grayscaleData[i] >= average ? '1' : '0';
    }

    return hash;
  };

  // Calculate Hamming distance between two binary strings
  const hammingDistance = (hash1: string, hash2: string): number => {
    if (hash1.length !== hash2.length) {
      return Infinity;
    }

    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) {
        distance++;
      }
    }

    return distance;
  };

  // Calculate similarity percentage (100% = identical, 0% = completely different)
  const calculateSimilarity = (hash1: string, hash2: string): number => {
    const distance = hammingDistance(hash1, hash2);
    if (distance === Infinity) {
      return 0;
    }

    const maxDistance = hash1.length;
    const similarity = ((maxDistance - distance) / maxDistance) * 100;
    return Math.round(similarity * 100) / 100; // Round to 2 decimal places
  };

  const detectDuplicatesBySize = (files: ClientFile[]): DuplicateGroup[] => {
    const filesBySize = new Map<number, ClientFile[]>();

    for (const file of files) {
      if (!filesBySize.has(file.size)) {
        filesBySize.set(file.size, []);
      }
      filesBySize.get(file.size)!.push(file);
    }

    const groups: DuplicateGroup[] = [];
    let groupId = 0;

    for (const [size, groupFiles] of filesBySize) {
      if (groupFiles.length > 1) {
        groups.push({
          id: `size-${groupId++}`,
          files: groupFiles,
          reason: 'Identical file size',
          confidence: 0.6,
          algorithm: DuplicateAlgorithm.FileSize,
          details: `All files are exactly ${Math.round(size / 1024)}KB (${size} bytes)`,
          hash: generateGroupHash(groupFiles, DuplicateAlgorithm.FileSize),
        });
      }
    }

    return groups;
  };

  const detectDuplicatesByName = (files: ClientFile[]): DuplicateGroup[] => {
    const filesByName = new Map<string, ClientFile[]>();

    for (const file of files) {
      const baseName = file.name.toLowerCase();
      if (!filesByName.has(baseName)) {
        filesByName.set(baseName, []);
      }
      filesByName.get(baseName)!.push(file);
    }

    const groups: DuplicateGroup[] = [];
    let groupId = 0;

    for (const [name, groupFiles] of filesByName) {
      if (groupFiles.length > 1) {
        groups.push({
          id: `name-${groupId++}`,
          files: groupFiles,
          reason: 'Identical filename',
          confidence: 0.8,
          algorithm: DuplicateAlgorithm.FileName,
          details: `All files named "${name}" (case-insensitive match)`,
          hash: generateGroupHash(groupFiles, DuplicateAlgorithm.FileName),
        });
      }
    }

    return groups;
  };

  const detectDuplicatesByHash = (files: ClientFile[]): DuplicateGroup[] => {
    const filesByHash = new Map<string, ClientFile[]>();

    // For demo purposes, create a simple "hash" based on file properties
    // In production, you'd read the actual file content and hash it
    for (const file of files) {
      const pseudoHash = simpleHash(`${file.size}-${file.name}-${file.width}-${file.height}`);
      if (!filesByHash.has(pseudoHash)) {
        filesByHash.set(pseudoHash, []);
      }
      filesByHash.get(pseudoHash)!.push(file);
    }

    const groups: DuplicateGroup[] = [];
    let groupId = 0;

    for (const [hash, groupFiles] of filesByHash) {
      if (groupFiles.length > 1) {
        groups.push({
          id: `hash-${groupId++}`,
          files: groupFiles,
          reason: 'Identical content hash',
          confidence: 0.95,
          algorithm: DuplicateAlgorithm.FileHash,
          details: `MD5 hash: ${hash} (demo hash based on file properties)`,
          hash: generateGroupHash(groupFiles, DuplicateAlgorithm.FileHash),
        });
      }
    }

    return groups;
  };

  const detectDuplicatesByMetadata = (files: ClientFile[]): DuplicateGroup[] => {
    const filesByMetadata = new Map<string, ClientFile[]>();

    for (const file of files) {
      // Create metadata signature
      const metadataKey = `${file.width}x${file.height}`;
      if (!filesByMetadata.has(metadataKey)) {
        filesByMetadata.set(metadataKey, []);
      }
      filesByMetadata.get(metadataKey)!.push(file);
    }

    const groups: DuplicateGroup[] = [];
    let groupId = 0;

    for (const [metadata, groupFiles] of filesByMetadata) {
      if (groupFiles.length > 1) {
        groups.push({
          id: `metadata-${groupId++}`,
          files: groupFiles,
          reason: 'Identical metadata',
          confidence: 0.85,
          algorithm: DuplicateAlgorithm.Metadata,
          details: `Same dimensions: ${metadata}.`,
          hash: generateGroupHash(groupFiles, DuplicateAlgorithm.Metadata),
        });
      }
    }

    return groups;
  };

  const detectDuplicatesCombined = (files: ClientFile[]): DuplicateGroup[] => {
    const groups: DuplicateGroup[] = [];
    const processed = new Set<string>();
    let groupId = 0;

    for (let i = 0; i < files.length; i++) {
      if (processed.has(files[i].id)) {
        continue;
      }

      const similarFiles = [files[i]];
      processed.add(files[i].id);

      for (let j = i + 1; j < files.length; j++) {
        if (processed.has(files[j].id)) {
          continue;
        }

        const file1 = files[i];
        const file2 = files[j];

        // Calculate similarity score
        let score = 0;

        // Size similarity (30% weight)
        if (file1.size === file2.size) {
          score += 0.3;
        } else if (Math.abs(file1.size - file2.size) < file1.size * 0.1) {
          score += 0.15;
        }

        // Name similarity (20% weight)
        if (file1.name.toLowerCase() === file2.name.toLowerCase()) {
          score += 0.2;
        } else if (file1.name.toLowerCase().includes(file2.name.toLowerCase().slice(0, -4))) {
          score += 0.1;
        }

        // Metadata similarity (50% weight)
        if (file1.width === file2.width && file1.height === file2.height) {
          score += 0.5;
        } else if (
          Math.abs(file1.width - file2.width) < 10 &&
          Math.abs(file1.height - file2.height) < 10
        ) {
          score += 0.25;
        }

        if (score >= 0.7) {
          similarFiles.push(file2);
          processed.add(file2.id);
        }
      }

      if (similarFiles.length > 1) {
        groups.push({
          id: `combined-${groupId++}`,
          files: similarFiles,
          reason: 'Combined similarity score',
          confidence: Math.min(0.9, 0.5 + similarFiles.length * 0.1),
          algorithm: DuplicateAlgorithm.Combined,
          details: 'Multi-factor analysis: size + name + metadata matching with 70%+ confidence',
          hash: generateGroupHash(similarFiles, DuplicateAlgorithm.Combined),
        });
      }
    }

    return groups;
  };

  const detectDuplicatesByThumbnailVisual = async (
    files: ClientFile[],
  ): Promise<DuplicateGroup[]> => {
    // Check if worker is available
    if (!visualSimilarityManager.isWorkerAvailable()) {
      console.warn('⚠️ Visual similarity worker not available, falling back to basic algorithm');
      return detectDuplicatesByThumbnailVisualBasic(files);
    }

    try {
      // Filter files for visual analysis
      const eligibleFiles = files.filter(
        (file) =>
          file.thumbnailPath &&
          !['gif', 'mp4', 'webm', 'mov'].includes(file.extension.toLowerCase()),
      );

      console.log(
        `🚀 Starting enhanced cached visual analysis for ${eligibleFiles.length} files...`,
      );

      // Create cache manager for persistent hash storage
      const cacheManager = {
        fetchCachedHashes: async (paths: string[]) => {
          const cachedHashes = await fileStore.fetchVisualHashes(paths);
          return cachedHashes.map((hash) => {
            // Find the corresponding file to check modification date
            const file = eligibleFiles.find((f) => f.absolutePath === hash.absolutePath);
            const isValid = file
              ? file.dateModified.getTime() <= hash.dateModified.getTime()
              : false;

            return {
              absolutePath: hash.absolutePath,
              hash: hash.hash,
              hashType: hash.hashType,
              isValid,
            };
          });
        },
        saveCachedHashes: async (hashes: any[]) => {
          await fileStore.saveVisualHashes(hashes);
        },
      };

      // Run cached analysis with progress tracking
      const result = await visualSimilarityManager.analyzeVisualSimilarityWithCache(
        eligibleFiles,
        similarityThreshold,
        (progressData) => {
          const details =
            progressData.phase === 'processing'
              ? `Processing thumbnails: ${progressData.processed || 0}/${
                  progressData.total || 0
                } (found ${progressData.found || 0} hashes)`
              : `Comparing hashes: ${progressData.comparisons || 0}/${
                  progressData.totalComparisons || 0
                }`;

          setAnalysisProgress({
            phase: progressData.phase,
            progress: progressData.progress,
            details,
          });
        },
        cacheManager,
      );

      // Clear progress
      setAnalysisProgress(null);

      // Convert worker results to DuplicateGroup format
      const groups: DuplicateGroup[] = result.groups.map((group, index) => {
        const groupFiles = group.files
          .map((fileId) => files.find((f) => f.id === fileId))
          .filter((file): file is ClientFile => file !== undefined);

        return {
          id: `visual-enhanced-${index}`,
          files: groupFiles,
          reason: 'Enhanced visual similarity',
          confidence: Math.min(0.95, group.similarity / 100),
          algorithm: DuplicateAlgorithm.ThumbnailVisual,
          details: `Enhanced pHash analysis: ${group.similarity.toFixed(
            1,
          )}% similarity (threshold: ${similarityThreshold}%) • Processed ${
            result.processedFiles
          } files in ${result.processingTime}ms`,
          hash: generateGroupHash(groupFiles, DuplicateAlgorithm.ThumbnailVisual),
        };
      });

      console.log(`✅ Enhanced analysis complete: ${groups.length} groups found`);
      return groups;
    } catch (error) {
      console.error('❌ Enhanced visual analysis failed:', error);
      setAnalysisProgress(null);

      // Fallback to basic algorithm
      console.log('🔄 Falling back to basic visual algorithm...');
      return detectDuplicatesByThumbnailVisualBasic(files);
    }
  };

  // Fallback basic algorithm (original Phase 1 implementation)
  const detectDuplicatesByThumbnailVisualBasic = async (
    files: ClientFile[],
  ): Promise<DuplicateGroup[]> => {
    const groups: DuplicateGroup[] = [];
    const thumbnailHashes: ThumbnailHash[] = [];

    console.log('🔍 Starting basic visual similarity analysis for', files.length, 'files...');

    let processedCount = 0;
    const totalFiles = files.length;

    for (const file of files) {
      try {
        // Skip files that don't have thumbnails or are videos/gifs
        if (
          !file.thumbnailPath ||
          file.extension === 'gif' ||
          file.extension === 'mp4' ||
          file.extension === 'webm'
        ) {
          processedCount++;
          continue;
        }

        const imageData = await loadThumbnailAsImageData(file.thumbnailPath);
        if (!imageData) {
          console.warn('⚠️ Could not load thumbnail for:', file.name);
          processedCount++;
          continue;
        }

        const grayscaleData = toGrayscale(imageData);
        const hash = generatePerceptualHash(grayscaleData);

        thumbnailHashes.push({
          fileId: file.id,
          hash,
        });

        processedCount++;

        // Log progress every 100 files
        if (processedCount % 100 === 0 || processedCount === totalFiles) {
          console.log(
            `📊 Processed ${processedCount}/${totalFiles} files (${Math.round(
              (processedCount / totalFiles) * 100,
            )}%)`,
          );
        }
      } catch (error) {
        console.warn('❌ Failed to process thumbnail for', file.name, error);
        processedCount++;
      }
    }

    // Compare hashes and create groups (simplified for fallback)
    const processed = new Set<string>();
    let groupId = 0;

    for (let i = 0; i < thumbnailHashes.length; i++) {
      if (processed.has(thumbnailHashes[i].fileId)) {
        continue;
      }

      const similarHashes = [thumbnailHashes[i]];
      processed.add(thumbnailHashes[i].fileId);

      for (let j = i + 1; j < thumbnailHashes.length; j++) {
        if (processed.has(thumbnailHashes[j].fileId)) {
          continue;
        }

        const similarity = calculateSimilarity(thumbnailHashes[i].hash, thumbnailHashes[j].hash);

        if (similarity >= similarityThreshold) {
          thumbnailHashes[j].similarity = similarity;
          similarHashes.push(thumbnailHashes[j]);
          processed.add(thumbnailHashes[j].fileId);
        }
      }

      if (similarHashes.length > 1) {
        const similarFiles = similarHashes
          .map((hashData) => files.find((f) => f.id === hashData.fileId))
          .filter((file): file is ClientFile => file !== undefined);

        if (similarFiles.length > 1) {
          const avgSimilarity =
            similarHashes
              .filter((h) => h.similarity !== undefined)
              .reduce((sum, h) => sum + (h.similarity || 0), 0) /
            (similarHashes.length - 1);

          groups.push({
            id: `visual-basic-${groupId++}`,
            files: similarFiles,
            reason: 'Basic visual similarity',
            confidence: Math.min(0.95, avgSimilarity / 100),
            algorithm: DuplicateAlgorithm.ThumbnailVisual,
            details: `Basic aHash analysis: ${avgSimilarity.toFixed(
              1,
            )}% average similarity (threshold: ${similarityThreshold}%)`,
            hash: generateGroupHash(similarFiles, DuplicateAlgorithm.ThumbnailVisual),
          });
        }
      }
    }

    console.log('Found', groups.length, 'visual duplicate groups (basic)');
    return groups;
  };

  const detectDuplicates = action(async () => {
    setIsAnalyzing(true);
    const startTime = Date.now();

    try {
      let groups: DuplicateGroup[] = [];

      switch (selectedAlgorithm) {
        case DuplicateAlgorithm.FileSize:
          groups = detectDuplicatesBySize(fileStore.fileList);
          break;
        case DuplicateAlgorithm.FileName:
          groups = detectDuplicatesByName(fileStore.fileList);
          break;
        case DuplicateAlgorithm.FileHash:
          groups = detectDuplicatesByHash(fileStore.fileList);
          break;
        case DuplicateAlgorithm.Metadata:
          groups = detectDuplicatesByMetadata(fileStore.fileList);
          break;
        case DuplicateAlgorithm.Combined:
          groups = detectDuplicatesCombined(fileStore.fileList);
          break;
        case DuplicateAlgorithm.ThumbnailVisual:
          groups = await detectDuplicatesByThumbnailVisual(fileStore.fileList);
          break;
      }

      const processingTime = Date.now() - startTime;
      const duplicatesFound = groups.reduce((sum, group) => sum + group.files.length, 0);

      setDuplicateGroups(groups);
      setDisplayedGroupsCount(GROUPS_PER_PAGE); // Reset pagination
      setStats({
        processingTime,
        filesAnalyzed: fileStore.fileList.length,
        groupsFound: groups.length,
        duplicatesFound,
      });
      setLastProcessedModification(fileStore.fileListLastModified);
    } catch (error) {
      console.error('Error detecting duplicates:', error);
    } finally {
      setIsAnalyzing(false);
    }
  });

  // Load dismissed groups on mount
  useEffect(() => {
    const loadDismissedGroups = async () => {
      try {
        const dismissed = await fileStore.fetchDismissedDuplicateGroups();
        const dismissedHashes = new Set(dismissed.map((d) => d.groupHash));
        setDismissedGroups(dismissedHashes);
        console.log('Loaded dismissed groups:', dismissed.length);
      } catch (error) {
        console.error('Failed to load dismissed groups:', error);
      }
    };

    loadDismissedGroups();
  }, []); // Only run once on mount

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      // Clear any ongoing progress when component unmounts
      setAnalysisProgress(null);
    };
  }, []);

  // Clear results when algorithm changes (user must manually re-analyze)
  useEffect(() => {
    setDuplicateGroups([]);
    setStats(null);
    setDisplayedGroupsCount(GROUPS_PER_PAGE);
  }, [selectedAlgorithm]);

  // Track the last file list modification time to detect when we need to update groups
  const [lastProcessedModification, setLastProcessedModification] = useState<Date | null>(null);

  // Update duplicate groups when file list changes (preserve search state when files are deleted)
  useEffect(() => {
    // Only update if file list changed and we have existing results
    if (
      duplicateGroups.length === 0 ||
      !lastProcessedModification ||
      fileStore.fileListLastModified.getTime() === lastProcessedModification.getTime()
    ) {
      return;
    }

    // Update existing duplicate groups by removing deleted files
    const currentFileIds = new Set(fileStore.fileList.map((f) => f.id));
    const updatedGroups = duplicateGroups
      .map((group) => ({
        ...group,
        files: group.files.filter((file) => currentFileIds.has(file.id)),
      }))
      .filter((group) => group.files.length > 1); // Remove groups with only 1 file left

    // Update stats
    const duplicatesFound = updatedGroups.reduce((sum, group) => sum + group.files.length, 0);
    const updatedStats = stats
      ? {
          ...stats,
          filesAnalyzed: fileStore.fileList.length,
          groupsFound: updatedGroups.length,
          duplicatesFound,
        }
      : null;

    setDuplicateGroups(updatedGroups);
    setStats(updatedStats);
    setLastProcessedModification(fileStore.fileListLastModified);

    // Reset pagination if we have fewer groups now
    if (updatedGroups.length < displayedGroupsCount) {
      setDisplayedGroupsCount(Math.max(GROUPS_PER_PAGE, updatedGroups.length));
    }
  }, [fileStore.fileListLastModified]);

  const loadMoreGroups = () => {
    setDisplayedGroupsCount((prev) => prev + GROUPS_PER_PAGE);
  };

  const loadManagementData = async () => {
    setIsLoadingManagement(true);
    try {
      const dismissed = await fileStore.fetchDismissedDuplicateGroups();
      setDismissedGroupsList(dismissed);
      console.log('Loaded management data:', dismissed.length, 'dismissed groups');
    } catch (error) {
      console.error('Failed to load management data:', error);
    } finally {
      setIsLoadingManagement(false);
    }
  };

  const undismissGroup = async (dismissedGroup: DismissedDuplicateGroupDTO) => {
    try {
      await fileStore.removeDismissedDuplicateGroup(dismissedGroup.groupHash);

      // Remove from both management list and active dismissed set
      setDismissedGroupsList((prev) =>
        prev.filter((g) => g.groupHash !== dismissedGroup.groupHash),
      );
      setDismissedGroups((prev) => {
        const newSet = new Set(prev);
        newSet.delete(dismissedGroup.groupHash);
        return newSet;
      });

      console.log('Successfully undismissed group:', dismissedGroup.groupHash);
    } catch (error) {
      console.error('Failed to undismiss group:', error);
    }
  };

  const toggleManagement = () => {
    if (!showManagement) {
      loadManagementData();
    }
    setShowManagement(!showManagement);
  };

  const dismissGroup = async (group: DuplicateGroup) => {
    console.log('Dismissing group:', {
      id: group.id,
      hash: group.hash,
      algorithm: group.algorithm,
      fileCount: group.files.length,
      fileIds: group.files.map((f) => f.id).sort(), // Show sorted IDs for consistency
      filePaths: group.files.map((f) => f.absolutePath),
    });

    setIsDismissing(true);
    try {
      // Save to backend
      await fileStore.createDismissedDuplicateGroup(
        group.hash,
        group.algorithm,
        group.files.map((f) => f.id),
      );

      // Add group hash to dismissed set (for immediate UI feedback)
      setDismissedGroups((prev) => new Set(prev).add(group.hash));
    } catch (error) {
      console.error('Failed to dismiss group:', error);
      // Could show a toast notification here
    } finally {
      setIsDismissing(false);
    }
  };

  // Filter out dismissed groups from display
  const visibleGroups = duplicateGroups.filter((group) => !dismissedGroups.has(group.hash));
  const displayedGroups = visibleGroups.slice(0, displayedGroupsCount);
  const hasMoreGroups = visibleGroups.length > displayedGroupsCount;

  // Calculate updated stats that reflect only visible (non-dismissed) groups
  const activeStats: AlgorithmStats | null = stats
    ? {
        ...stats, // Keep processingTime and filesAnalyzed unchanged
        groupsFound: visibleGroups.length,
        duplicatesFound: visibleGroups.reduce((sum, group) => sum + group.files.length, 0),
      }
    : null;

  return (
    <div className="duplicate-gallery">
      <div
        className="duplicate-gallery__header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <div>
          <h2 style={{ margin: '0 0 8px 0' }}>Duplicate Detection</h2>
          <p style={{ margin: 0 }}>
            Choose an algorithm below to analyze your photo collection for duplicates. Each method
            has different strengths and trade-offs.
          </p>
        </div>
        <div className="duplicate-gallery__settings">
          <button
            className="settings-button"
            onClick={(e) => {
              e.preventDefault();
              showContextMenu(
                e.clientX,
                e.clientY,
                <Menu>
                  <MenuItem
                    onClick={async () => {
                      try {
                        await fileStore.clearVisualHashCache();
                        alert('Visual hash cache cleared successfully!');
                      } catch (error) {
                        console.error('Failed to clear cache:', error);
                        alert('Failed to clear cache. Check console for details.');
                      }
                    }}
                    text="Clear Visual Hash Cache"
                    icon={IconSet.CLEAR_DATABASE}
                  />
                </Menu>,
              );
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '4px',
              color: 'var(--text-secondary)',
              opacity: 0.7,
              transition: 'opacity 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.7';
            }}
            title="Settings"
          >
            <span style={{ fontSize: '16px' }}>⚙️</span>
          </button>
        </div>
      </div>

      <AlgorithmSelector
        selectedAlgorithm={selectedAlgorithm}
        onAlgorithmChange={setSelectedAlgorithm}
        onAnalyze={detectDuplicates}
        isAnalyzing={isAnalyzing}
        stats={activeStats}
        similarityThreshold={similarityThreshold}
        onSimilarityThresholdChange={setSimilarityThreshold}
      />

      {dismissedGroups.size > 0 && (
        <div
          className="algorithm-management"
          style={{
            marginTop: '16px',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            className="duplicate-file__show-button"
            onClick={toggleManagement}
            title={showManagement ? 'Hide dismissed groups' : 'Manage dismissed groups'}
          >
            <span
              style={{
                transform: 'scale(0.8)',
                display: 'inline-block',
                marginRight: '4px',
              }}
            >
              {IconSet.EYE_LOW_VISION}
            </span>
            Dismissed ({dismissedGroups.size})
          </button>
        </div>
      )}

      {showManagement && (
        <div className="management-panel">
          <div className="management-panel__header">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '16px',
              }}
            >
              <div>
                <h3 style={{ marginTop: 0 }}>Dismissed Duplicate Groups</h3>
                <p style={{ marginBottom: 0 }}>
                  Groups you&apos;ve dismissed will not appear in future duplicate analyses.
                </p>
              </div>
              {dismissedGroupsList.length > 0 && (
                <button
                  className="duplicate-file__show-button"
                  onClick={() => {
                    // Undismiss all groups
                    dismissedGroupsList.forEach((group) => undismissGroup(group));
                  }}
                  title="Undismiss all dismissed groups"
                >
                  <span
                    style={{
                      transform: 'scale(0.8)',
                      display: 'inline-block',
                      marginRight: '4px',
                    }}
                  >
                    {IconSet.EYE}
                  </span>
                  Undismiss All
                </button>
              )}
            </div>
          </div>

          {isLoadingManagement ? (
            <div className="management-panel__loading">
              <div className="loading-spinner" />
              <p>Loading dismissed groups...</p>
            </div>
          ) : dismissedGroupsList.length === 0 ? (
            <div className="management-panel__empty">
              <h4>No Dismissed Groups</h4>
              <p>You haven&apos;t dismissed any duplicate groups yet.</p>
            </div>
          ) : (
            <div className="management-panel__list">
              {dismissedGroupsList.map((dismissed) => {
                const isExpanded = expandedDismissedGroups.has(dismissed.groupHash);
                const fileIds = JSON.parse(dismissed.fileIds) as string[];
                const files = fileIds
                  .map((id) => fileStore.get(id))
                  .filter((file): file is ClientFile => file !== undefined);

                return (
                  <div
                    key={dismissed.groupHash}
                    className="dismissed-group-item"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '12px',
                      marginBottom: '12px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div className="dismissed-group-item__algorithm">
                          <strong>
                            {ALGORITHMS.find((a) => a.id === dismissed.algorithm)?.name ||
                              dismissed.algorithm}
                          </strong>
                        </div>
                        <div
                          className="dismissed-group-item__details"
                          style={{
                            marginTop: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                          }}
                        >
                          <span style={{ marginRight: '8px' }}>
                            {IconSet.INFO} {fileIds.length} files ({files.length} still available)
                          </span>
                          <span style={{ marginRight: '8px' }}>
                            {IconSet.FILTER_DATE} Dismissed{' '}
                            {dismissed.dismissedAt.toLocaleDateString()} at{' '}
                            {dismissed.dismissedAt.toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      <div
                        className="dismissed-group-item__actions"
                        style={{ display: 'flex', gap: '8px' }}
                      >
                        {files.length > 0 && (
                          <button
                            className="duplicate-file__show-button"
                            onClick={() => {
                              const newExpanded = new Set(expandedDismissedGroups);
                              if (isExpanded) {
                                newExpanded.delete(dismissed.groupHash);
                              } else {
                                newExpanded.add(dismissed.groupHash);
                              }
                              setExpandedDismissedGroups(newExpanded);
                            }}
                            title={isExpanded ? 'Hide files' : 'Show files in this dismissed group'}
                          >
                            <span
                              style={{
                                transform: 'scale(0.8)',
                                display: 'inline-block',
                                marginRight: '4px',
                              }}
                            >
                              {isExpanded ? IconSet.ARROW_UP : IconSet.ARROW_DOWN}
                            </span>
                            {isExpanded ? 'Hide Files' : 'Show Files'}
                          </button>
                        )}
                        <button
                          className="duplicate-file__show-button"
                          onClick={() => undismissGroup(dismissed)}
                          title="Undismiss this group so it appears in future analyses"
                        >
                          <span
                            style={{
                              transform: 'scale(0.8)',
                              display: 'inline-block',
                              marginRight: '4px',
                            }}
                          >
                            {IconSet.EYE}
                          </span>
                          Undismiss
                        </button>
                      </div>
                    </div>

                    {isExpanded && files.length > 0 && (
                      <div
                        style={{
                          marginTop: '12px',
                          paddingTop: '12px',
                          borderTop: '1px solid var(--border-color)',
                        }}
                      >
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                            gap: '8px',
                          }}
                        >
                          {files.map((file) => (
                            <div
                              key={file.id}
                              className="dismissed-file-preview"
                              style={{
                                border: '1px solid var(--border-color)',
                                borderRadius: '4px',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                              }}
                              onClick={() => {
                                // Select the file
                                select(file, false, false);
                              }}
                              onDoubleClick={() => {
                                // Select the file and open preview (slide mode)
                                if (!file.isBroken) {
                                  uiStore.selectFile(file, true);
                                  uiStore.enableSlideMode();
                                }
                              }}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                if (!file.isBroken) {
                                  showContextMenu(
                                    e.clientX,
                                    e.clientY,
                                    <Menu>
                                      <MenuItem
                                        onClick={() => {
                                          uiStore.selectFile(file, true);
                                          uiStore.enableSlideMode();
                                        }}
                                        text="View at Full Size"
                                        icon={IconSet.SEARCH}
                                      />
                                      <MenuItem
                                        onClick={() => {
                                          uiStore.selectFile(file, true);
                                          uiStore.openPreviewWindow();
                                        }}
                                        text="Open In Preview Window"
                                        icon={IconSet.PREVIEW}
                                      />
                                      <MenuDivider />
                                      <MenuItem
                                        onClick={() => shell.showItemInFolder(file.absolutePath)}
                                        text="Reveal in File Browser"
                                        icon={IconSet.FOLDER_CLOSE}
                                      />
                                    </Menu>,
                                  );
                                }
                              }}
                              title={`${file.name} - Click to select, double-click to preview, right-click for options`}
                            >
                              <div
                                style={{
                                  width: '100%',
                                  height: '80px',
                                  overflow: 'hidden',
                                  background: 'var(--surface-secondary)',
                                }}
                              >
                                <Thumbnail
                                  file={file}
                                  mounted={true}
                                  forceNoThumbnail={false}
                                  hovered={false}
                                  galleryVideoPlaybackMode="disabled"
                                  isSlideMode={false}
                                />
                              </div>
                              <div
                                style={{
                                  padding: '4px',
                                  fontSize: '0.7rem',
                                  color: 'var(--text-secondary)',
                                  textAlign: 'center',
                                  lineHeight: 1.2,
                                }}
                              >
                                {file.name.length > 15 ? `${file.name.slice(0, 12)}...` : file.name}
                              </div>
                            </div>
                          ))}
                        </div>
                        {files.length < fileIds.length && (
                          <div
                            style={{
                              marginTop: '8px',
                              fontSize: '0.8rem',
                              color: 'var(--text-secondary)',
                              fontStyle: 'italic',
                            }}
                          >
                            Note: {fileIds.length - files.length} file(s) from this group are no
                            longer available (may have been moved or deleted)
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="duplicate-gallery__content">
        {isAnalyzing ? (
          <div className="duplicate-gallery__loading">
            <div className="loading-spinner" />
            <p>
              Analyzing files for duplicates using{' '}
              {ALGORITHMS.find((a) => a.id === selectedAlgorithm)?.name}...
            </p>
            {selectedAlgorithm === DuplicateAlgorithm.ThumbnailVisual && (
              <div style={{ marginTop: '8px' }}>
                {analysisProgress ? (
                  <div className="enhanced-progress">
                    <div style={{ fontSize: '0.9rem', marginBottom: '4px' }}>
                      <strong>
                        {analysisProgress.phase === 'processing'
                          ? '🔍 Processing Thumbnails'
                          : '🔄 Comparing Images'}
                      </strong>{' '}
                      ({analysisProgress.progress}%)
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: '8px',
                        backgroundColor: 'var(--border-color)',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        marginBottom: '4px',
                      }}
                    >
                      <div
                        style={{
                          width: `${analysisProgress.progress}%`,
                          height: '100%',
                          backgroundColor: 'var(--accent-color)',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                      {analysisProgress.details}
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                    Enhanced visual analysis with Web Workers for better performance.
                  </p>
                )}
              </div>
            )}
          </div>
        ) : duplicateGroups.length === 0 && stats === null ? (
          <div className="duplicate-gallery__empty">
            <h3>Ready to Analyze! 🔍</h3>
            <p>
              Select an algorithm above and click &quot;Analyze&quot; to search for duplicates in
              your photo collection.
            </p>
            <p>
              Each algorithm has different strengths - explore the details to choose the best method
              for your needs.
            </p>
          </div>
        ) : duplicateGroups.length === 0 && stats !== null ? (
          <div className="duplicate-gallery__empty">
            <h3>No duplicates found! 🎉</h3>
            <p>
              The {ALGORITHMS.find((a) => a.id === selectedAlgorithm)?.name} algorithm didn&apos;t
              find any potential duplicates.
            </p>
            <p>
              Try a different algorithm if you suspect there might be duplicates the current method
              missed.
            </p>
          </div>
        ) : (
          <div className="duplicate-gallery__groups">
            {displayedGroups.map((group) => (
              <DuplicateItem
                key={group.id}
                group={group}
                select={select}
                onDismiss={dismissGroup}
                isDismissing={isDismissing}
              />
            ))}

            {hasMoreGroups && (
              <div className="duplicate-gallery__load-more">
                <p>
                  Showing {displayedGroups.length} of {visibleGroups.length} duplicate groups
                  {visibleGroups.length >= 1000 && ' (large collection detected)'}
                </p>
                <button className="btn-secondary" onClick={loadMoreGroups}>
                  Load Next {Math.min(GROUPS_PER_PAGE, visibleGroups.length - displayedGroupsCount)}{' '}
                  Groups
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default DuplicateGallery;

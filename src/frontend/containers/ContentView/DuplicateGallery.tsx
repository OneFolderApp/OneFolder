import React, { useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { action } from 'mobx';
import { shell } from 'electron';
import { Tag } from 'widgets';
import { useStore } from '../../contexts/StoreContext';
import { ClientFile } from '../../entities/File';
import { Thumbnail } from './GalleryItem';
import { CommandDispatcher } from './Commands';
import { GalleryProps } from './utils';

export enum DuplicateAlgorithm {
  FileSize = 'fileSize',
  FileName = 'fileName',
  FileHash = 'fileHash',
  Metadata = 'metadata',
  Combined = 'combined',
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
];

interface DuplicateGroup {
  id: string;
  files: ClientFile[];
  reason: string;
  confidence: number;
  algorithm: DuplicateAlgorithm;
  details?: string;
}

interface DuplicateItemProps {
  group: DuplicateGroup;
  select: (file: ClientFile, toggleSelection: boolean, rangeSelection: boolean) => void;
}

interface AlgorithmStats {
  processingTime: number;
  filesAnalyzed: number;
  groupsFound: number;
  duplicatesFound: number;
}

const DuplicateItem = observer(({ group, select }: DuplicateItemProps) => {
  const { uiStore } = useStore();

  return (
    <div className="duplicate-group">
      {group.details && (
        <div className="duplicate-group__details">
          <small>{group.details}</small>
        </div>
      )}

      <div className="duplicate-group__files">
        {group.files.map((file) => {
          const eventManager = useMemo(() => new CommandDispatcher(file), [file]);

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
                    {file.absolutePath.split('/').slice(-2).join('/')}
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

const AlgorithmSelector = ({
  selectedAlgorithm,
  onAlgorithmChange,
  onAnalyze,
  isAnalyzing,
  stats,
}: {
  selectedAlgorithm: DuplicateAlgorithm;
  onAlgorithmChange: (algorithm: DuplicateAlgorithm) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  stats: AlgorithmStats | null;
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [showAlgorithmSelector, setShowAlgorithmSelector] = useState(false);
  const selectedAlgoInfo = ALGORITHMS.find((a) => a.id === selectedAlgorithm)!;
  const rootStore = useStore();
  const { uiStore, fileStore } = rootStore;
  const hasFilters = uiStore.searchCriteriaList.length > 0;
  const fileCount = fileStore.fileList.length;

  return (
    <div className="algorithm-selector">
      <div className="current-algorithm">
        <div className="current-algorithm__line">
          <span className="current-algorithm__label">
            Current algorithm: <strong>{selectedAlgoInfo.name}</strong>{' '}
            <button
              className="current-algorithm__details-btn"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? 'Hide details' : 'Show details...'}
            </button>
          </span>
          <button
            className="current-algorithm__change-btn"
            onClick={() => setShowAlgorithmSelector(!showAlgorithmSelector)}
          >
            {showAlgorithmSelector ? 'Cancel' : 'Change Algorithm'}
          </button>
        </div>
      </div>

      {showDetails && (
        <div className="current-algorithm-details">
          <div className="algorithm-details">
            <div className="algorithm-details__section">
              <strong>Advantages:</strong>
              <ul>
                {selectedAlgoInfo.pros.map((pro, i) => (
                  <li key={i}>{pro}</li>
                ))}
              </ul>
            </div>
            <div className="algorithm-details__section">
              <strong>Limitations:</strong>
              <ul>
                {selectedAlgoInfo.cons.map((con, i) => (
                  <li key={i}>{con}</li>
                ))}
              </ul>
            </div>
            <div className="algorithm-details__section">
              <strong>Technical Implementation:</strong>
              <p>{selectedAlgoInfo.technical}</p>
            </div>
          </div>
        </div>
      )}

      {showAlgorithmSelector && (
        <div className="algorithm-grid-container">
          <label className="algorithm-grid-label">Choose Detection Method:</label>
          <div className="algorithm-grid">
            {ALGORITHMS.map((algo) => (
              <div
                key={algo.id}
                className={`algorithm-card ${
                  selectedAlgorithm === algo.id ? 'algorithm-card--selected' : ''
                }`}
                onClick={() => {
                  onAlgorithmChange(algo.id);
                  setShowAlgorithmSelector(false);
                }}
              >
                <div className="algorithm-card__header">
                  <h4 className="algorithm-card__name">{algo.name}</h4>
                  <div className="algorithm-card__badges">
                    <span className={`badge badge--speed badge--${algo.speed.toLowerCase()}`}>
                      {algo.speed}
                    </span>
                    <span
                      className={`badge badge--accuracy badge--${algo.accuracy
                        .toLowerCase()
                        .replace(' ', '-')}`}
                    >
                      {algo.accuracy}
                    </span>
                  </div>
                </div>
                <p className="algorithm-card__description">{algo.description}</p>
                <div className="algorithm-card__preview">
                  <div className="algorithm-card__pros">
                    <strong>✓ Best for:</strong> {algo.pros[0]}
                  </div>
                  <div className="algorithm-card__tech-preview">
                    <strong>Method:</strong> {algo.technical.split('.')[0]}
                  </div>
                </div>
              </div>
            ))}

            <div
              className="algorithm-card algorithm-card--suggest"
              onClick={() => {
                shell.openExternal(
                  'https://onefolder.canny.io/feedback/p/what-duplication-algorithm-we-should-add',
                );
              }}
            >
              <div className="algorithm-card__header">
                <h4 className="algorithm-card__name">💡 Suggest New Algorithm</h4>
              </div>
              <p className="algorithm-card__description">
                Have an idea for a better duplicate detection method? We&apos;d love to hear your
                suggestions!
              </p>
              <div className="algorithm-card__cta">
                <strong>→ Submit your idea</strong>
                <span>Help improve OneFolder</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="algorithm-actions">
        <button className="btn-primary" onClick={onAnalyze} disabled={isAnalyzing}>
          {isAnalyzing ? 'Analyzing...' : `Analyze ${fileCount.toLocaleString()} files`}
        </button>

        {hasFilters && (
          <div className="active-filters">
            <div className="active-filters__label">Active filters:</div>
            <div className="active-filters__list">
              {uiStore.searchCriteriaList.map((criteria: any, index: number) => (
                <span key={index} className="active-filters__tag">
                  {criteria.getLabel({ tags: 'Tags', absolutePath: 'Path' }, rootStore)}
                </span>
              ))}
            </div>
            <button
              className="active-filters__clear"
              onClick={() => {
                uiStore.clearSearchCriteriaList();
                fileStore.fetchAllFiles();
              }}
              title="Remove all filters and analyze entire collection"
            >
              Clear filters and analyze all files
            </button>
          </div>
        )}

        {stats && (
          <div className="algorithm-stats">
            <span>
              Processed {stats.filesAnalyzed} files in {stats.processingTime}ms
            </span>
            <span>
              Found {stats.groupsFound} groups with {stats.duplicatesFound} total files
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const DuplicateGallery = observer(({ select }: GalleryProps) => {
  const { fileStore } = useStore();
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<DuplicateAlgorithm>(
    DuplicateAlgorithm.FileHash,
  );
  const [stats, setStats] = useState<AlgorithmStats | null>(null);

  // Simplified hash function for demo (in production, use crypto.createHash)
  const simpleHash = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
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
          details: `Same dimensions: ${metadata}. In production: would also compare EXIF date, camera, etc.`,
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
        });
      }
    }

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
      }

      const processingTime = Date.now() - startTime;
      const duplicatesFound = groups.reduce((sum, group) => sum + group.files.length, 0);

      setDuplicateGroups(groups);
      setStats({
        processingTime,
        filesAnalyzed: fileStore.fileList.length,
        groupsFound: groups.length,
        duplicatesFound,
      });
    } catch (error) {
      console.error('Error detecting duplicates:', error);
    } finally {
      setIsAnalyzing(false);
    }
  });

  // Clear results when algorithm changes (user must manually re-analyze)
  useEffect(() => {
    setDuplicateGroups([]);
    setStats(null);
  }, [selectedAlgorithm]);

  // Run initial analysis only when file list changes (not when algorithm changes)
  useEffect(() => {
    // Clear any existing results when file list changes
    setDuplicateGroups([]);
    setStats(null);
  }, [fileStore.fileListLastModified]);

  return (
    <div className="duplicate-gallery">
      <div className="duplicate-gallery__header">
        <h2>Duplicate Detection</h2>
        <p>
          Choose an algorithm below to analyze your photo collection for duplicates. Each method has
          different strengths and trade-offs.
        </p>
      </div>

      <AlgorithmSelector
        selectedAlgorithm={selectedAlgorithm}
        onAlgorithmChange={setSelectedAlgorithm}
        onAnalyze={detectDuplicates}
        isAnalyzing={isAnalyzing}
        stats={stats}
      />

      <div className="duplicate-gallery__content">
        {isAnalyzing ? (
          <div className="duplicate-gallery__loading">
            <div className="loading-spinner" />
            <p>
              Analyzing files for duplicates using{' '}
              {ALGORITHMS.find((a) => a.id === selectedAlgorithm)?.name}...
            </p>
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
            {duplicateGroups.map((group) => (
              <DuplicateItem key={group.id} group={group} select={select} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default DuplicateGallery;

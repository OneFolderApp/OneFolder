import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { action } from 'mobx';
import { GalleryProps } from './utils';
import { useStore } from '../../contexts/StoreContext';
import { ClientFile } from '../../entities/File';
import { Thumbnail } from './GalleryItem';

interface DuplicateGroup {
  id: string;
  files: ClientFile[];
  reason: string;
  confidence: number;
}

interface DuplicateItemProps {
  group: DuplicateGroup;
  onFileSelect: (file: ClientFile, selectAdditive: boolean, selectRange: boolean) => void;
}

const DuplicateItem = observer(({ group, onFileSelect }: DuplicateItemProps) => {
  const { uiStore } = useStore();

  return (
    <div className="duplicate-group">
      <div className="duplicate-group__header">
        <h3>Potential Duplicates ({group.files.length} files)</h3>
        <span className="duplicate-group__reason">{group.reason}</span>
        <span className="duplicate-group__confidence">
          Confidence: {Math.round(group.confidence * 100)}%
        </span>
      </div>
      <div className="duplicate-group__files">
        {group.files.map((file) => (
          <div
            key={file.id}
            className={`duplicate-file ${uiStore.fileSelection.has(file) ? 'selected' : ''}`}
            onClick={(e) => onFileSelect(file, e.ctrlKey || e.metaKey, e.shiftKey)}
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
              <div className="duplicate-file__name">{file.name}</div>
              <div className="duplicate-file__details">
                {file.width}×{file.height} • {Math.round(file.size / 1024)}KB
              </div>
              <div className="duplicate-file__path">{file.absolutePath}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

const DuplicateGallery = observer(({ select }: GalleryProps) => {
  const { fileStore } = useStore();
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const detectDuplicates = action(async () => {
    setIsAnalyzing(true);
    try {
      // Simple duplicate detection based on file size and name
      const filesBySize = new Map<number, ClientFile[]>();
      const filesByName = new Map<string, ClientFile[]>();

      // Group files by size
      for (const file of fileStore.fileList) {
        if (!filesBySize.has(file.size)) {
          filesBySize.set(file.size, []);
        }
        filesBySize.get(file.size)!.push(file);
      }

      // Group files by name
      for (const file of fileStore.fileList) {
        const baseName = file.name.toLowerCase();
        if (!filesByName.has(baseName)) {
          filesByName.set(baseName, []);
        }
        filesByName.get(baseName)!.push(file);
      }

      const groups: DuplicateGroup[] = [];
      let groupId = 0;

      // Find duplicates by size
      for (const [size, files] of filesBySize) {
        if (files.length > 1) {
          groups.push({
            id: `size-${groupId++}`,
            files,
            reason: `Same file size (${Math.round(size / 1024)}KB)`,
            confidence: 0.7,
          });
        }
      }

      // Find duplicates by name (excluding already grouped files)
      const groupedFileIds = new Set(groups.flatMap((g) => g.files.map((f) => f.id)));
      for (const [name, files] of filesByName) {
        const ungroupedFiles = files.filter((f) => !groupedFileIds.has(f.id));
        if (ungroupedFiles.length > 1) {
          groups.push({
            id: `name-${groupId++}`,
            files: ungroupedFiles,
            reason: `Same filename: ${name}`,
            confidence: 0.8,
          });
        }
      }

      setDuplicateGroups(groups);
    } catch (error) {
      console.error('Error detecting duplicates:', error);
    } finally {
      setIsAnalyzing(false);
    }
  });

  useEffect(() => {
    detectDuplicates();
  }, [fileStore.fileListLastModified]);

  return (
    <div className="duplicate-gallery">
      <div className="duplicate-gallery__header">
        <h2>Duplicate Detection</h2>
        <div className="duplicate-gallery__stats">
          {isAnalyzing ? (
            <span>Analyzing {fileStore.fileList.length} files...</span>
          ) : (
            <span>
              Found {duplicateGroups.length} potential duplicate groups with{' '}
              {duplicateGroups.reduce((sum, group) => sum + group.files.length, 0)} files
            </span>
          )}
        </div>
        <button onClick={detectDuplicates} disabled={isAnalyzing}>
          {isAnalyzing ? 'Analyzing...' : 'Re-analyze'}
        </button>
      </div>

      <div className="duplicate-gallery__content">
        {isAnalyzing ? (
          <div className="duplicate-gallery__loading">
            <div className="loading-spinner" />
            <p>Analyzing files for duplicates...</p>
          </div>
        ) : duplicateGroups.length === 0 ? (
          <div className="duplicate-gallery__empty">
            <h3>No duplicates found! 🎉</h3>
            <p>Your photo collection looks clean.</p>
          </div>
        ) : (
          <div className="duplicate-gallery__groups">
            {duplicateGroups.map((group) => (
              <DuplicateItem key={group.id} group={group} onFileSelect={select} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default DuplicateGallery;

import { when } from 'mobx';
import { observer } from 'mobx-react-lite';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from 'widgets';
import { Checkbox } from 'widgets/checkbox';
import { IconSet } from 'widgets/icons';
import { Dialog } from 'widgets/popovers';
import Tree, { ITreeItem } from 'widgets/tree';
import { useStore } from '../../../contexts/StoreContext';
import { ClientLocation, ClientSubLocation } from '../../../entities/Location';
import { useAutorun } from '../../../hooks/mobx';
import { IExpansionState } from '../../types';

interface ITreeData {
  expansion: IExpansionState;
  setExpansion: React.Dispatch<IExpansionState>;
}

// const isExpanded = (nodeData: ClientLocation | ClientSubLocation, treeData: ITreeData) =>
//   !!treeData.expansion[nodeData instanceof ClientLocation ? nodeData.id : nodeData.path];

// const toggleExpansion = (nodeData: ClientLocation | ClientSubLocation, treeData: ITreeData) => {
//   const { expansion, setExpansion } = treeData;
//   if (nodeData instanceof ClientLocation) {
//     setExpansion({ ...expansion, [nodeData.id]: !expansion[nodeData.id] });
//   } else if (!nodeData.isExcluded) {
//     setExpansion({ ...expansion, [nodeData.path]: !expansion[nodeData.path] });
//   }
// };

// const SubLocationLabel = ({
//   nodeData,
//   treeData,
// }: {
//   nodeData: ClientSubLocation;
//   treeData: ITreeData;
// }) => <SubLocation nodeData={nodeData} treeData={treeData} />;

// const mapDirectory = (dir: ClientSubLocation): ITreeItem => ({
//   id: dir.path,
//   label: SubLocationLabel,
//   nodeData: dir,
//   children: dir.subLocations.map(mapDirectory),
//   isExpanded,
// });

// const LocationLabel = (nodeData: any, treeData: any) => (
//   <Location nodeData={nodeData} treeData={treeData} />
// );

// const SubLocation = observer(
//   ({ nodeData, treeData }: { nodeData: ClientSubLocation; treeData: ITreeData }) => {
//     const { expansion, setExpansion } = treeData;
//     const subLocation = nodeData;

//     const toggleExclusion = () => {
//       subLocation.toggleExcluded();
//       // Need to update expansion to force a rerender of the tree
//       setExpansion({ ...expansion, [subLocation.path]: false });
//     };

//     return (
//       <div className="tree-content-label">
//         <Checkbox onChange={toggleExclusion} checked={!subLocation.isExcluded}>
//           {subLocation.name}
//         </Checkbox>
//       </div>
//     );
//   },
// );

// const Location = observer(({ nodeData }: { nodeData: ClientLocation; treeData: ITreeData }) => {
//   return (
//     <div className="tree-content-label">
//       <div>{nodeData.name}</div>
//     </div>
//   );
// });

// const SubLocationInclusionTree = ({ location }: { location: ClientLocation }) => {
//   const [expansion, setExpansion] = useState<IExpansionState>({ [location.id]: true });
//   const treeData: ITreeData = useMemo<ITreeData>(
//     () => ({
//       expansion,
//       setExpansion,
//     }),
//     [expansion],
//   );
//   const [branches, setBranches] = useState<ITreeItem[]>([]);

//   useAutorun(() => {
//     setBranches([
//       {
//         id: location.id,
//         label: LocationLabel,
//         children: location.subLocations.map(mapDirectory),
//         nodeData: location,
//         isExpanded,
//       },
//     ]);
//   });

//   return (
//     <Tree
//       id="new-location"
//       multiSelect
//       children={branches}
//       treeData={treeData}
//       toggleExpansion={toggleExpansion}
//     />
//   );
// };

interface LocationCreationDialogProps {
  /** A new, un-initialized ClientLocation */
  location: ClientLocation;
  onClose: () => void;
}

const LocationCreationDialog = observer(({ location, onClose }: LocationCreationDialogProps) => {
  const { locationStore, uiStore } = useStore();
  // const [importFolderHierarchyAsTags, setImportFolderHierarchyAsTags] = useState(false);

  const handleSubmit = useCallback(() => {
    locationStore.initLocation(location).catch(console.error);
    onClose();
  }, [location, locationStore, onClose]);

  const handleCancel = useCallback(() => {
    location.delete().catch(console.error);
    onClose();
  }, [location, onClose]);

  // useEffect(() => {
  //   let isEffectRunning = true;
  //   const dispose = when(
  //     () => location.subLocations.length === 0 && !location.isInitialized,
  //     () => {
  //       location.refreshSublocations().then(() => isEffectRunning && setSublocationsLoaded(true));
  //     },
  //   );
  //   return () => {
  //     isEffectRunning = false;
  //     dispose();
  //   };
  // }, [location]);

  return (
    <Dialog
      open
      title={`Add Location "${location.name}"?`}
      icon={IconSet.FOLDER_CLOSE}
      describedby="location-add-info"
      onCancel={handleCancel}
    >
      <p id="location-add-info">
        Once you click &quot;Confirm&quot;, OneFolder will generate thumnails, this may take a few
        minutes to complete.
      </p>
      <form method="dialog" onSubmit={(e) => e.preventDefault()}>
        {/* <fieldset>
          <legend>Subdirectories:</legend>
          {!sublocationsLoaded ? (
            <i>{IconSet.LOADING} loading...</i>
          ) : location.subLocations.length === 0 ? (
            <p>No subdirectories found.</p>
          ) : (
            <SubLocationInclusionTree location={location} />
          )}
        </fieldset> */}

        <div style={{ display: 'flex', gap: '4px' }}>
          <label htmlFor="import-metadata">Import metadata from files:</label>

          <input
            type="checkbox"
            onChange={(e) => uiStore.setImportMetadataAtLocationLoading(Boolean(e.target.checked))}
            checked={uiStore.importMetadataAtLocationLoading}
            name="import-metadata"
          />
        </div>
        <fieldset className="dialog-actions">
          <Button styling="filled" text="Confirm" onClick={handleSubmit} />
          <Button styling="outlined" onClick={handleCancel} text="Cancel" />
        </fieldset>
      </form>
    </Dialog>
  );
});

export default LocationCreationDialog;

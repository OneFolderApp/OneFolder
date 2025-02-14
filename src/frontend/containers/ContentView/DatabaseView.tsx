import React, { FC } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../contexts/StoreContext';

/**
 * Props for DatabaseView.
 *
 * @property contentRect Optional layout information.
 * @property select Optional selection handler.
 * @property lastSelectionIndex Optional ref for last selection index.
 */
interface DatabaseViewProps {
  contentRect?: any;
  select?: (selectedFile: any, toggleSelection: boolean, rangeSelection: boolean) => void;
  lastSelectionIndex?: React.MutableRefObject<number | undefined>;
}

/**
 * DatabaseView Component
 *
 * Displays a table view of all entities stored in the app.
 * Three tabs are provided: Files, Locations, and Tags.
 *
 * Each table is rendered one time based on the current data in the respective store.
 *
 * @param props Optional props (ignored by this debug view).
 * @returns {JSX.Element} A tabbed view displaying data.
 */
const DatabaseView: FC<DatabaseViewProps> = observer((props): JSX.Element => {
  // Tabs can be "files", "locations", or "tags"
  const [activeTab, setActiveTab] = React.useState<'files' | 'locations' | 'tags'>('files');
  const { fileStore, locationStore, tagStore } = useStore();

  // Get the data for the active tab
  let data: any[] = [];
  if (activeTab === 'files') {
    data = fileStore.fileList;
  } else if (activeTab === 'locations') {
    // Assuming locationStore has a locationList property
    data = locationStore.locationList || [];
  } else if (activeTab === 'tags') {
    // Convert readonly array to mutable array using spread operator.
    data = [...tagStore.tagList] || [];
  }

  // If there is no data, display a message
  if (!data || data.length === 0) {
    return (
      <div>
        {renderTabHeader(activeTab, setActiveTab)}
        <div style={{ padding: '16px' }}>No data available for {activeTab}.</div>
      </div>
    );
  }

  // Derive column headers from the keys of the first element
  const headers = Object.keys(data[0]);

  return (
    <div>
      {renderTabHeader(activeTab, setActiveTab)}
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '80vh', marginTop: '16px' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              {headers.map((header) => (
                <th
                  key={header}
                  style={{
                    border: '1px solid #ccc',
                    padding: '8px',
                    background: '#f9f9f9',
                    textAlign: 'left',
                  }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={index}>
                {headers.map((header) => (
                  <td
                    key={header}
                    style={{
                      border: '1px solid #ccc',
                      padding: '8px',
                      verticalAlign: 'top',
                    }}
                  >
                    {formatValue(item[header])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

/**
 * Renders the tab header with buttons for each tab.
 *
 * @param activeTab The currently active tab.
 * @param setActiveTab Callback to change the active tab.
 * @returns {JSX.Element} The tab header.
 */
function renderTabHeader(
  activeTab: 'files' | 'locations' | 'tags',
  setActiveTab: (tab: 'files' | 'locations' | 'tags') => void,
): JSX.Element {
  const tabStyle = (tab: string): React.CSSProperties => ({
    padding: '8px 16px',
    cursor: 'pointer',
    borderBottom: activeTab === tab ? '2px solid blue' : '2px solid transparent',
    background: activeTab === tab ? '#e0e0e0' : '#f0f0f0',
    marginRight: '8px',
  });
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid #ccc' }}>
      <div style={tabStyle('files')} onClick={() => setActiveTab('files')}>
        Files
      </div>
      <div style={tabStyle('locations')} onClick={() => setActiveTab('locations')}>
        Locations
      </div>
      <div style={tabStyle('tags')} onClick={() => setActiveTab('tags')}>
        Tags
      </div>
    </div>
  );
}

/**
 * Formats a value for display in the table.
 * If the value is an object or array, it will be stringified.
 *
 * @param value The value to format.
 * @returns {string} The formatted value.
 */
function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }
  return String(value);
}

export default DatabaseView;

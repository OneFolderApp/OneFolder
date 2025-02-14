import React from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../contexts/StoreContext';

/**
 * DatabaseView Component
 *
 * Displays a table view of all file objects stored in the fileStore.
 * Each row corresponds to a file, and each column represents a property of the file.
 *
 * This component renders the table one time based on the current fileStore data.
 *
 * @returns {JSX.Element} A table displaying all file properties.
 */
const DatabaseView = observer((): JSX.Element => {
  const { fileStore } = useStore();
  const files = fileStore.fileList;

  // If there are no files, display a message
  if (!files || files.length === 0) {
    return <div>No files available.</div>;
  }

  // Derive column headers from the keys of the first file
  const headers = Object.keys(files[0]);

  return (
    <div style={{ overflowX: 'auto' }}>
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
          {files.map((file, index) => (
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
                  {formatValue(file[header])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

/**
 * Formats a value for display in the table.
 * If the value is an object or array, it will be stringified.
 *
 * @param {any} value The value to format.
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

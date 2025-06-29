import { observer } from 'mobx-react-lite';
import React from 'react';
import { useStore } from '../../contexts/StoreContext';
import UiStore from 'src/frontend/stores/UiStore';

export const UsagePreferences = () => {
  return (
    <>
      <h3>Recently Used Tags</h3>

      <div className="vstack">
        <RecentTagsNumber />
      </div>
    </>
  );
};

const RecentTagsNumber = observer(() => {
  const { uiStore } = useStore();

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = Number(event.target.value);
    uiStore.setRecentlyUsedTagsMaxLength(value);
    // update recentlyUsedTags size
    uiStore.addRecentlyUsedTag();
  };

  return (
    <label>
      Maximum number of recently used tags to remember
      <select value={uiStore.recentlyUsedTagsMaxLength} onChange={handleChange}>
        {[...Array(UiStore.MAX_RECENTLY_USED_TAGS + 1)].map((_, i) => (
          <option key={i} value={i}>
            {i}
          </option>
        ))}
      </select>
    </label>
  );
});

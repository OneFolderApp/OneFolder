import { action } from 'mobx';
import { observer } from 'mobx-react-lite';
import React, { useEffect, useState } from 'react';

import { Button, IconSet, Tag } from 'widgets';
import { Dialog } from 'widgets/popovers';
import { useStore } from '../../../contexts/StoreContext';
import { ClientTag } from '../../../entities/Tag';
import { TagSelector } from 'src/frontend/components/TagSelector';
import { AppToaster } from 'src/frontend/components/Toaster';

interface TagImplyProps {
  tag: ClientTag;
  onClose: () => void;
}

/** this component is only shown when all tags in the context do not have child-tags */
export const TagImply = observer(({ tag, onClose }: TagImplyProps) => {
  const [impliedTags, setImpliedTags] = useState<ClientTag[]>(Array.from(tag.impliedTags));

  const imply = action((impliedTag: ClientTag) => {
    if (tag === impliedTag) {
      // Show an error toast
      AppToaster.show({
        message: 'You cannot imply a tag with itself',
        timeout: 3000,
        type: 'error',
      });
    } else if (tag.isAncestor(impliedTag)) {
      // Show an error toast
      AppToaster.show({
        message: 'You cannot imply a parent tag',
        timeout: 3000,
        type: 'error',
      });
    } else if (impliedTag.isAncestor(tag)) {
      // Show an error toast
      AppToaster.show({
        message: 'You cannot imply a child tag',
        timeout: 3000,
        type: 'error',
      });
    } else {
      setImpliedTags([...impliedTags, impliedTag]);
    }
  })

  const unimply = action((impliedTag: ClientTag) => {
    setImpliedTags(impliedTags.filter((tag) => tag !== impliedTag));
  })

  const unimplyAll = action(() => {
    setImpliedTags([]);
  })


  const firstUpdate = React.useRef(true);
  useEffect(() => {
    // Ignore the first update, since it's just the initial value
    if (firstUpdate.current) {
      firstUpdate.current = false;
      return;
    }

    // Automatically save when the tags change
    save();
  }, [impliedTags]);

  const save = action(() => {
    tag.replaceImpliedTags(impliedTags);

    if (impliedTags.length > 0) {
      AppToaster.show({
        message: `Tag "${tag.name}" now implies "${impliedTags.map((v) => v.name).join('", "')}"`,
        timeout: 3000,
        type: 'success',
      }, "imply-toast");
    } else {
      AppToaster.show({
        message: `Tag "${tag.name}" no longer implies any tags`,
        timeout: 3000,
        type: 'success',
      }, "imply-toast");
    }
  })

  return (
    <Dialog
      open
      title={`Modify Implied Tags`}
      icon={IconSet.TAG_GROUP}
      onCancel={onClose}
      describedby="imply-info"
    >
      <p id="imply-info">
        This allows you to modify the implied tags for a tag. <br></br>
        Note: You cannot imply a parent, child, inherited implied, or implied-by tag, to avoid circular relationships and maintain a clearer structure.
      </p>
      <form method="dialog" onSubmit={(e) => e.preventDefault()}>
        <fieldset>
          <div id="tag-imply-overview">
            <span>Changing implied tags for </span><Tag key={tag.id} text={tag.name} color={tag.viewColor} />
          </div>

          <br />

          <label htmlFor="tag-imply-picker">Imply tags</label>
          <TagSelector
            disabled={false}
            selection={impliedTags}
            onSelect={imply}
            onDeselect={unimply}
            onClear={unimplyAll}
            multiline
            filter={(t) => tag !== t && !tag.isImpliedAncestor(t) && !t.isImpliedAncestor(tag)}
          />
        </fieldset>
        <br />
        <fieldset className="dialog-actions">
          <Button
            text="Save"
            styling="filled"
            onClick={() => { save(); onClose() }}
          />
          <Button
            text="Cancel"
            styling="filled"
            onClick={onClose}
          />
        </fieldset>
      </form>
    </Dialog>
  );
});
/* eslint-disable react/no-unescaped-entities */
import { observer } from 'mobx-react-lite';
import React, { memo, useCallback, useRef, useState } from 'react';

import { chromeExtensionUrl, firefoxExtensionUrl } from 'common/config';
import { clamp } from 'common/core';
import Logo_About from 'resources/images/helpcenter/logo-about-helpcenter-dark.jpg';
import { Button, ButtonGroup, IconSet, Split } from 'widgets';
import { ToolbarButton } from 'widgets/toolbar';
import ExternalLink from '../components/ExternalLink';
import PopupWindow from '../components/PopupWindow';
import { useStore } from '../contexts/StoreContext';

const HelpCenter = observer(() => {
  const { uiStore } = useStore();

  if (!uiStore.isHelpCenterOpen) {
    return null;
  }
  return (
    <PopupWindow
      onClose={uiStore.closeHelpCenter}
      windowName="help-center"
      closeOnEscape
      additionalCloseKey={uiStore.hotkeyMap.toggleHelpCenter}
    >
      <Documentation
        id="help-center"
        overviewId="help-center-overview"
        className={`${uiStore.theme} scrollbar-classic`}
        initPages={PAGE_DATA}
      />
    </PopupWindow>
  );
});

export default HelpCenter;

interface IDocumentation {
  id?: string;
  overviewId: string;
  className?: string;
  initPages: () => IPageData[];
}

const Documentation = ({ id, overviewId, className, initPages }: IDocumentation) => {
  const [pageIndex, setPageIndex] = useState(0);
  const pages = useRef(initPages()).current;

  const [isIndexOpen, setIndexIsOpen] = useState(true);
  const [splitPoint, setSplitPoint] = useState(224); // 14rem
  const handleMove = useCallback(
    (x: number, width: number) => {
      const minWidth = 224;
      if (isIndexOpen) {
        const w = clamp(x, minWidth, width * 0.75);
        setSplitPoint(w);

        if (x < minWidth * 0.75) {
          setIndexIsOpen(false);
        }
      } else if (x >= minWidth) {
        setIndexIsOpen(true);
      }
    },
    [isIndexOpen],
  );

  return (
    <div id={id} className={className}>
      <Split
        primary={<Overview id={overviewId} pages={pages} openPage={setPageIndex} />}
        secondary={
          <Page
            toolbar={
              <PageToolbar
                isIndexOpen={isIndexOpen}
                toggleIndex={setIndexIsOpen}
                controls={overviewId}
              />
            }
            pages={pages}
            openPage={setPageIndex}
            pageIndex={pageIndex}
          />
        }
        axis="vertical"
        align="left"
        splitPoint={splitPoint}
        isExpanded={isIndexOpen}
        onMove={handleMove}
      />
    </div>
  );
};

interface IOverview {
  id: string;
  pages: IPageData[];
  openPage: (page: number) => void;
}

const Overview = memo(function Overview({ id, pages, openPage }: IOverview) {
  return (
    <nav id={id} className="doc-overview">
      {pages.map((page, pageIndex) => (
        <details open key={page.title}>
          <summary>
            {page.icon}
            {page.title}
          </summary>
          {page.sections.map((section) => (
            <a
              key={section.title}
              href={`#${section.title.toLowerCase().replaceAll(' ', '-')}`}
              onClick={() => openPage(pageIndex)}
            >
              {section.title}
            </a>
          ))}
        </details>
      ))}
    </nav>
  );
});

interface IPage {
  toolbar: React.ReactNode;
  pages: IPageData[];
  pageIndex: number;
  openPage: (page: number) => void;
}

const Page = (props: IPage) => {
  const { toolbar, pages, pageIndex, openPage } = props;

  const buttons = [];
  if (pageIndex > 0) {
    const previousPage = () => openPage(pageIndex - 1);
    buttons.push(
      <Button key="previous" styling="outlined" onClick={previousPage} text="Previous" />,
    );
  }
  if (pageIndex < pages.length - 1) {
    const nextPage = () => openPage(pageIndex + 1);
    buttons.push(<Button key="next" styling="outlined" onClick={nextPage} text="Next" />);
  }

  return (
    <div className="doc-page">
      {toolbar}
      <article className="doc-page-content">
        {pages[pageIndex].sections.map((section) => (
          <section id={section.title.toLowerCase().replaceAll(' ', '-')} key={section.title}>
            <h2>{section.title}</h2>
            {section.content}
          </section>
        ))}
        <ButtonGroup>{buttons}</ButtonGroup>
      </article>
    </div>
  );
};

interface IPageToolbar {
  isIndexOpen: boolean;
  toggleIndex: React.Dispatch<React.SetStateAction<boolean>>;
  controls: string;
}

const PageToolbar = ({ isIndexOpen, toggleIndex, controls }: IPageToolbar) => {
  return (
    <div role="toolbar" className="doc-page-toolbar" data-compact>
      <ToolbarButton
        text="Toggle Index"
        icon={isIndexOpen ? IconSet.DOUBLE_CARET : IconSet.MENU_HAMBURGER}
        pressed={isIndexOpen}
        controls={controls}
        onClick={() => toggleIndex((value) => !value)}
        tabIndex={0}
      />
    </div>
  );
};

interface IPageData {
  title: string;
  icon: React.ReactNode;
  sections: { title: string; content: React.ReactNode }[];
}

const PAGE_DATA: () => IPageData[] = () => [
  {
    title: 'About Allusion',
    icon: IconSet.LOGO,
    sections: [
      {
        title: 'What is Allusion',
        content: (
          <>
            <img className="centered" src={Logo_About} alt="Logo" />
            <p>
              <strong>
                Allusion is a tool designed to help artists organize their visual library. It is
                very common for creative people to use reference images throughout their projects.
              </strong>
            </p>
            <p>
              Finding such images has become relatively easy through the use of internet technology.
              Managing such images on the other hand, has remained a challenge. Clearly, it is not
              the amount of images that we can store, but a question of what we can effectively
              access, that matters. If only a handful of images were relevant to us, it would be
              easy to keep them in mind, but many artists are interested in creating their own
              curated library, and in such, it becomes increasingly difficult to remember where
              images were. Again, Allusion was created to help artists organize their visual
              library. To learn more about how Allusion works, please read on.
            </p>
          </>
        ),
      },
    ],
  },
  {
    title: 'Library Setup',
    icon: IconSet.META_INFO,
    sections: [
      {
        title: 'Getting Started',
        content: (
          <>
            <p>
              Library setup refers to the process of getting your images into Allusion, so that they
              are available to be managed and viewed. Rather than manually importing images from
              your filesystem, Allusion focuses on linked folders, which we refer to as{' '}
              <b>Locations</b>. Read on to find out about how to add images to your Allusion
              library.
            </p>
          </>
        ),
      },
      {
        title: 'Locations',
        content: (
          <>
            <p>
              In Allusion, the primary way of adding images to your library is the use of
              "Locations". A location in this context is a link to a folder on your computer. This
              means that all images in that folder as well as any subfolders will be automatically
              loaded once it is added to your list of locations.
              <br />
              The benefit of this system is that you can have full control over where your data is
              stored, while not having to tediously import images manually from various places. To
              add more images, simply place them into the linked folder, and they will automatically
              show up in Allusion.
              <br />
              However, removing images from a linked folder will not automatically remove them from
              Allusion in order to prevent you from losing the tags you assigned to them when you
              accidentially remove your images, or move them elsewhere. To confirm to Allusion the
              files were deleted intentionally, you can select those images in the "Missing images"
              view and pressing the delete button in the toolbar. Otherwise, you can simply place
              the images back to their original path so that Allusion will automatically detect them
              again.
              <br />
              You are free to rename your images, and to move them to a different folder, as long as
              they remain within the same location. Allusion will automatically detect those changes
              upon you restarting the application.
            </p>
            <p>
              To add a new location, open the outliner and hover with your mouse over the location's
              header. You will see a small plus icon to the right. Once you click the icon, go ahead
              and browse the folder that contains images. Confirm your selection and select your
              location preferences in the following popup. You have the option to exclude subfolders
              during this process. Excluding subfolders later is also possible but keep in mind that
              Allusion does not store tag data for excluded folders. Any existing tag data will be
              removed when you choose to exclude a subfolder. Once you confirm, your images will
              show up in the content area.
            </p>
            <p>
              To remove a location, open the outliner and right click on a location. A context menu
              will open with the option to remove your location. You have to confirm this action.
              Please be aware that removing a location will delete all tagging information that may
              have been attached to images of that location. The images themselves on your
              filesystem however, will of course remain.
            </p>
          </>
        ),
      },
      {
        title: 'Drag & Drop',
        content: (
          <>
            <p>
              Another way of quickly importing images is by dragging them into your list of
              locations in the the application window. You can drag them from your file explorer,
              but also from any other sources like a web browser. When dropping those images, they
              will be copied in into the (sub)folder you chose.
            </p>
          </>
        ),
      },
      {
        title: 'Browser Extension',
        content: (
          <>
            <p>
              A browser extension for FireFox and Chromium-based browsers such as Google Chrome and
              Edge is available. It allows you to import images into Allusion directly from your web
              browser and immediately tag them as well. Take a look in the "Background Processes"
              section in the settings window for more information. Get the extension here from{' '}
              <ExternalLink url={chromeExtensionUrl}>Chrome Webstore</ExternalLink> or for{' '}
              <ExternalLink url={firefoxExtensionUrl}>Firefox</ExternalLink>.
            </p>
          </>
        ),
      },
      {
        title: 'Tag Import/Export',
        content: (
          <>
            <p>
              You can save the tags stored in Allusion's internal database to the metadata of your
              image files. This allows you to view them in other applications, such as your file
              browser and tools like Adobe Bridge. This option is available in the "Import/Export"
              section of the settings window. Importing tags from file metadata can be performed in
              the same place.
              <br />
              Note that only the images shown in the gallery are affected by these operations!
            </p>
          </>
        ),
      },
    ],
  },
  {
    title: 'Tagging',
    icon: IconSet.TAG,
    sections: [
      {
        title: 'Tag Setup',
        content: (
          <>
            <p>
              Although it is possible to create tags on the fly, it is recommended to set up useful
              tags in advance to take full advantage of the organized tag structures that can be
              created in the outliner. The outliner has a tag related section below your locations.
              In this section you are able to create, edit and organize your tags.
            </p>
            <p>
              To create a new tag, simply press the plus icon next to the header. You have to hover
              the mouse over the region for the icon to become visible.
            </p>
            <p>
              To organize your tags, simply drag the list items across the outliner. You can drop
              items onto one another to create a hierarchy. In this way you can turn a list of many
              tags into a structured shape, so that it is easy for you to find the specific tags you
              were looking for. Alternatively, you can search for a tag in the File tags editor,
              right-click the tag you're searching for, and select "Reveal in tags panel" to quickly
              find a tag.
            </p>
            <p>
              Finally, to remove or edit an entry, right-click it and choose an action from the
              context menu. The tag tree also supports versatile selection using modifier keys: hold{' '}
              <strong>Alt</strong> to select whole tag collections (a tag and its sub-tags);
              otherwise, only visible tags are selected. Hold <strong>Command</strong>/
              <strong>Control</strong> to enable additive/subtractive selection. Hold{' '}
              <strong>Shift</strong> to select multiple items in range.
            </p>
          </>
        ),
      },
      {
        title: 'Implied Tags and Inherited Tags',
        content: (
          <>
            <p>
              You can set implied relationships to a tag through the tag's contextual menu option
              "Modify implied tags." When you tag a file, it also inherits all its ancestor tags and
              implied tags (and those from them too) automatically, to be used in search. For
              example, if the tag <em>dog</em> implies <em>mammal</em>, and <em>mammal</em> implies
              <em>animal</em>, then if you search for <em>animal</em>, files with the tag
              <em>dog</em> will also be included because of the implied relationship.
            </p>
            <p>
              Inherited tags can't be removed from a file unless you remove all the tags that cause
              them to be automatically inherited.
            </p>
            <p>
              It is possible to configure the visibility of tags and collections when they are
              inherited. You can decide exactly which tags appear in file thumbnails and tag lists
              by setting each tag’s "Visible When Inherited" status using the tag right-click menu.
              You can also configure the global inherited tags visibility mode in the Appearance
              settings. Available modes are: Show all (even those with "Visible When Inherited"
              status disabled), Show only "Visible When Inherited" tags (default mode), and Do not
              show inherited tags.
            </p>
            <p>
              When exporting tags to file metadata, only the explicitly assigned tags get exported
              to the file. The automatically inherited tags will not be included unless you
              explicitly assign them to the file.
            </p>
          </>
        ),
      },
      {
        title: 'How to Tag an Image',
        content: (
          <>
            <p>
              There are several ways to tag an image. First, you can drag a tag from the outliner
              onto an image. This also works on a selection of multiple images. Next, you can select
              an image, press 3 to open the tag editor, and assign or remove tags from the list.
              This method also allows you to tag multiple images at once. Finally, you can add tags
              by adding them to the list in the inspector panel - the sidebar on the right when
              viewing images at at full size.
            </p>
            <p>
              To remove tags from one or more images, you have to access either the tag editor or
              the inspector. In both places you will be able to remove individual tags or clear the
              entire set of tags on the selected image(s).
            </p>
            <p>
              When using the tag editor, you can hold ALT + arrow keys to navigate through the
              gallery items while keeping focus on the tag editor.
            </p>
          </>
        ),
      },
      {
        title: 'Navigation',
        content: (
          <>
            <p>
              When you have a large library of tags, it could be hard to find or remember where a
              tag is in the hierarchy, in this case you can search for the tag on the tag editor
              panel or in assigned tags in a file, and right-click them to show the option "Reveal
              in tags panel" to quickly find a tag.
            </p>
          </>
        ),
      },
    ],
  },
  {
    title: 'Extra Properties',
    icon: IconSet.OUTLINER4,
    sections: [
      {
        title: 'Extra Properties',
        content: (
          <>
            <p>
              You can define extra properties and add values to files using the Extra File
              Properties Editor panel (shortcut key 4) or the Inspector. Extra properties allow you
              to store additional information alongside your files and potentially use it to curate
              and organize your library even further.
            </p>
            <p>
              To create a new extra property definition, go to the Extra File Properties Editor or
              the Inspector and click the "+" plus icon button. Then enter a name for the new
              property and select one of the available creation options: currently, you can define
              properties of type number or text.
            </p>
            <p>
              To add an extra property to a file or multiple files, first select the files you want
              to edit. Then, go to the Extra File Properties Editor or the Inspector and click the
              "+" button to open the Extra Property Selector. You can search for a specific property
              using the text input and/or select the one you want to add.
            </p>
            <p>
              To edit the value of an extra property for a file or group of selected files, simply
              type the new value in the Extra File Properties Editor or in the Inspector.
              Number-type properties support positive decimal numbers, and text-type properties
              support multiline input (press Enter to create a new line).
            </p>
            <p>
              To rename, remove from a file, or delete an extra property definition, right-click the
              property in the Extra File Properties Editor or in the Extra Property Selector.
            </p>
            <p>
              You can sort your files by extra property values using the "Sort by" option in the
              contextual menu or in the "Sort View Content" panel in the toolbar.
            </p>
            <p>
              You can also use extra properties to create advanced search criteria and filter files
              based on their values.
            </p>
            <p>
              Extra properties are exported to file metadata when using the "Export Tags to File
              Metadata" option in the import/export settings menu.
            </p>
          </>
        ),
      },
    ],
  },
  {
    title: 'Search',
    icon: IconSet.SEARCH,
    sections: [
      {
        title: 'Quick Search',
        content: (
          <>
            <p>
              In Allusion there are several ways to find specific images. By default, the search bar
              lets you look for images based on their tags. You can press Ctrl-F to focus on the
              searchbar quickly. The advanced search can be accessed from the three dots icon in the
              upper right corner of Allusion.
            </p>
            <p>
              The searchbar that is always visible in the toolbar is the quickest way to search.
              Once you start typing, Allusion will make suggestions with an indication of any parent
              tags. Select the item from the list to add it to your search. You can narrow down an
              image by searching for several tags at once. If you search for two tags, by default,
              Allusion will return all images that have both tags assigned. You can change this
              behavior with the two circles icon on the right side of the search bar to return all
              images that have any of the two tags assigned instead. Finally keep in mind that
              Allusion will search for child tags recursivly by default. You can use the advanced
              search to exclude child tags from the result.
            </p>
            <p>You can also quickly refresh the gallery using the R shortcut.</p>
          </>
        ),
      },
      {
        title: 'Advanced Search',
        content: (
          <>
            <p>
              The advanced search can be opened by pressing the three dots icon in the upper right
              corner of Allusion, or by using the Ctrl-Shift-F shortcut. In that window you are able
              to create as many search criteria as you wish by listing them up. Enter your criteria
              in the criteria builder section of the advanced search. Then use the plus icon on the
              right side to add the finished criteria to the query editor below. Clicking on search
              will return all images that match with the criteria in the query editor, not with
              anything that is entered in the criteria builder.
            </p>
            <p>
              To take a closer look, each row in the interface represents one criteria and consists
              of three input fields. First select the type of information you want to look for. You
              can search for tags and file properties such as their name, size, type and creation
              date. You can then select an operator such as "equals", "greater than", "includes"
              etc. Finally you can enter the value of the selected property you wish to look for.
              Adding multiple criteria will again help you narrow down a search result.
            </p>
            <p>
              To provide some extra control when searching with multiple queries, you can swap
              between finding images that match all entered queries, or any of them. This toggle is
              available at the bottom of the advanced search panel, and at the right in the search
              bar when two or more queries have been entered.
            </p>
          </>
        ),
      },
    ],
  },
  {
    title: 'Inspection',
    icon: IconSet.INFO,
    sections: [
      {
        title: 'Content Area',
        content: (
          <>
            <p>
              The content area is the area in which your images are listed in the center of the
              window. There are several preferences you can set in the toolbar that will influence
              the way your images are listed. You can choose between several view modes by using the
              dropdown menu in the toolbar, or by right clicking anywhere in the content area. You
              can also sort the images according to various criteria. Finally, you can also change
              the size of your thumbnails. This can be changed in the context menu too, as well as
              in the settings menu.
            </p>
          </>
        ),
      },
      {
        title: 'Image Details',
        content: (
          <>
            <p>
              Each image carries a lot of information with it such as the file name, url,
              dimensions, etc. Such information can be viewed through the inspector. The inspector
              is a panel that is shown when viewing the image at full size, which can be performed
              by choosing said option in the context menu of an image, or simply by double clicking
              on it. This panel will allow you to see relevant meta-data of the file as well as the
              list of tags and scores assigned to the image. If the inspector is not visible in the
              full size view, find the information icon in the toolbar.
            </p>
          </>
        ),
      },
      {
        title: 'Image Preview Window',
        content: (
          <>
            <p>
              You can also preview images in a separate window by selecting an image and pressing
              the spacebar. The preview window will open and display your images. It is however
              important to take note that the preview window will only allow you to cycle through
              images in your selection. You can therefore select multiple images and preview just
              those in the new window. Press spacebar again to close the window.
            </p>
          </>
        ),
      },
    ],
  },
];

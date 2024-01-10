import React from 'react';
import { GalleryProps } from './utils';
import { shell } from 'electron';

import IMG_1 from 'resources/images/sample-calendar-pictures/photos_1.jpg';
import IMG_2 from 'resources/images/sample-calendar-pictures/photos_2.jpg';
import IMG_3 from 'resources/images/sample-calendar-pictures/photos_3.jpg';
import IMG_4 from 'resources/images/sample-calendar-pictures/photos_4.jpg';
import IMG_5 from 'resources/images/sample-calendar-pictures/photos_5.jpg';
import IMG_6 from 'resources/images/sample-calendar-pictures/photos_6.jpg';
import IMG_7 from 'resources/images/sample-calendar-pictures/photos_7.jpg';
import IMG_8 from 'resources/images/sample-calendar-pictures/photos_8.jpg';
import IMG_9 from 'resources/images/sample-calendar-pictures/photos_9.jpg';
import IMG_10 from 'resources/images/sample-calendar-pictures/photos_10.jpg';
import IMG_11 from 'resources/images/sample-calendar-pictures/photos_11.jpg';
import IMG_12 from 'resources/images/sample-calendar-pictures/photos_12.jpg';
import IMG_13 from 'resources/images/sample-calendar-pictures/photos_13.jpg';

type ProfilePicProps = {
  src: string;
};

const ProfilePic = ({ src }: ProfilePicProps) => {
  return (
    <div className="calendar-gallery__profile">
      <img
        className="calendar-gallery__profile-picture"
        src={src}
        alt={`Profile picture of ${name}`}
      />
    </div>
  );
};

const ListGallery = ({ contentRect, select, lastSelectionIndex }: GalleryProps) => {
  return (
    <div className="calendar-gallery">
      <div className="wip-container">
        The calendar is not ready yet.
        <br />
        <br />
        If you want to speed up the development you <br /> can vote on our roadmap:
        <br />
        <button
          className="wip-link"
          onClick={() => {
            shell.openExternal('/https://onefolder.canny.io/feedback/p/calendar-view');
          }}
        >
          onefolder.canny.io/feedback/p/calendar-view
        </button>
        <br />
        <br />
        <br />
        Comments and ideas are welcome 🙏
      </div>

      <h1>January 2024</h1>
      <div className="calendar-gallery__month-container">
        <ProfilePic src={IMG_1} />
        <ProfilePic src={IMG_2} />
        <ProfilePic src={IMG_3} />
        <ProfilePic src={IMG_4} />
        <ProfilePic src={IMG_5} />
        <ProfilePic src={IMG_6} />
        <ProfilePic src={IMG_7} />
        <ProfilePic src={IMG_8} />
        <ProfilePic src={IMG_9} />
      </div>

      <h1>December 2023</h1>
      <div className="calendar-gallery__month-container">
        <ProfilePic src={IMG_10} />
        <ProfilePic src={IMG_11} />
        <ProfilePic src={IMG_12} />
        <ProfilePic src={IMG_13} />
      </div>

      <h1>November 2023</h1>
      <div className="calendar-gallery__month-container">
        <ProfilePic src={IMG_7} />
        <ProfilePic src={IMG_9} />

        <ProfilePic src={IMG_1} />
        <ProfilePic src={IMG_2} />
        <ProfilePic src={IMG_3} />
        <ProfilePic src={IMG_4} />
        <ProfilePic src={IMG_5} />
        <ProfilePic src={IMG_6} />
        <ProfilePic src={IMG_8} />
      </div>
    </div>
  );
};

export default ListGallery;

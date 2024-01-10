import React from 'react';
import { GalleryProps } from './utils';

import IMG_1 from 'resources/images/sample-profile-pictures/profile_1.jpg';
import IMG_3 from 'resources/images/sample-profile-pictures/profile_3.jpg';
import IMG_4 from 'resources/images/sample-profile-pictures/profile_4.jpg';
import IMG_6 from 'resources/images/sample-profile-pictures/profile_6.jpg';
import IMG_7 from 'resources/images/sample-profile-pictures/profile_7.jpg';
import IMG_9 from 'resources/images/sample-profile-pictures/profile_9.jpg';
import IMG_15 from 'resources/images/sample-profile-pictures/profile_15.jpg';
import IMG_18 from 'resources/images/sample-profile-pictures/profile_18.jpg';
import IMG_22 from 'resources/images/sample-profile-pictures/profile_22.jpg';
import IMG_24 from 'resources/images/sample-profile-pictures/profile_24.jpg';
import IMG_25 from 'resources/images/sample-profile-pictures/profile_25.jpg';
import IMG_26 from 'resources/images/sample-profile-pictures/profile_26.jpg';
import IMG_27 from 'resources/images/sample-profile-pictures/profile_27.jpg';
import IMG_28 from 'resources/images/sample-profile-pictures/profile_28.jpg';
import IMG_29 from 'resources/images/sample-profile-pictures/profile_29.jpg';
import IMG_30 from 'resources/images/sample-profile-pictures/profile_30.jpg';
import IMG_31 from 'resources/images/sample-profile-pictures/profile_31.jpg';
import IMG_32 from 'resources/images/sample-profile-pictures/profile_32.jpg';
import IMG_33 from 'resources/images/sample-profile-pictures/profile_33.jpg';
import IMG_34 from 'resources/images/sample-profile-pictures/profile_34.jpg';
import IMG_35 from 'resources/images/sample-profile-pictures/profile_35.jpg';
import IMG_37 from 'resources/images/sample-profile-pictures/profile_37.jpg';
import IMG_38 from 'resources/images/sample-profile-pictures/profile_38.jpg';
import IMG_39 from 'resources/images/sample-profile-pictures/profile_39.jpg';

import { shell } from 'electron';

type ProfilePicProps = {
  src: string;
  name: string;
};

const ProfilePic = ({ src, name }: ProfilePicProps) => {
  return (
    <div className="face-gallery__profile">
      <img className="face-gallery__profile-picture" src={src} alt={`Profile picture of ${name}`} />
      <p>{name}</p>
    </div>
  );
};

const ListGallery = ({ contentRect, select, lastSelectionIndex }: GalleryProps) => {
  return (
    <div className="face-gallery">
      <div className="wip-container">
        Face view is not done yet.
        <br />
        <br />
        If you want to speed up the development you <br /> can vote on our roadmap:
        <br />
        <button
          className="wip-link"
          onClick={() => {
            shell.openExternal('https://onefolder.canny.io/feedback/p/face-view');
          }}
        >
          onefolder.canny.io/feedback/p/face-view
        </button>
        <br />
        <br />
        <br />
        Comments and ideas are welcome 🙏
      </div>
      <ProfilePic src={IMG_29} name="Mason" />
      <ProfilePic src={IMG_1} name="Emma" />
      <ProfilePic src={IMG_3} name="Ava" />
      <ProfilePic src={IMG_31} name="Alexander" />
      <ProfilePic src={IMG_4} name="Isabella" />
      <ProfilePic src={IMG_6} name="Noah" />
      <ProfilePic src={IMG_7} name="Sophia" />
      <ProfilePic src={IMG_9} name="Charlotte" />
      <ProfilePic src={IMG_15} name="Elizabeth" />
      <ProfilePic src={IMG_18} name="James" />
      <ProfilePic src={IMG_22} name="Oliver" />
      <ProfilePic src={IMG_24} name="Grace" />
      <ProfilePic src={IMG_25} name="Chloe" />
      <ProfilePic src={IMG_26} name="Elijah" />
      <ProfilePic src={IMG_27} name="Lucas" />
      <ProfilePic src={IMG_28} name="Victoria" />
      <ProfilePic src={IMG_30} name="Logan" />
      <ProfilePic src={IMG_32} name="Ethan" />
      <ProfilePic src={IMG_33} name="Jacob" />
      <ProfilePic src={IMG_34} name="Michael" />
      <ProfilePic src={IMG_35} name="Daniel" />
      <ProfilePic src={IMG_37} name="Jackson" />
      <ProfilePic src={IMG_38} name="Sebastian" />
      <ProfilePic src={IMG_39} name="Aiden" />
      {/* copy */}
      <ProfilePic src={IMG_29} name="Mason" />
      <ProfilePic src={IMG_1} name="Emma" />
      <ProfilePic src={IMG_3} name="Ava" />
      <ProfilePic src={IMG_31} name="Alexander" />
      <ProfilePic src={IMG_4} name="Isabella" />
      <ProfilePic src={IMG_6} name="Noah" />
      <ProfilePic src={IMG_7} name="Sophia" />
      <ProfilePic src={IMG_9} name="Charlotte" />
      <ProfilePic src={IMG_15} name="Elizabeth" />
      <ProfilePic src={IMG_18} name="James" />
      <ProfilePic src={IMG_22} name="Oliver" />
      <ProfilePic src={IMG_24} name="Grace" />
      <ProfilePic src={IMG_25} name="Chloe" />
      <ProfilePic src={IMG_26} name="Elijah" />
      <ProfilePic src={IMG_27} name="Lucas" />
      <ProfilePic src={IMG_28} name="Victoria" />
      <ProfilePic src={IMG_30} name="Logan" />
      <ProfilePic src={IMG_32} name="Ethan" />
      <ProfilePic src={IMG_33} name="Jacob" />
      <ProfilePic src={IMG_34} name="Michael" />
      <ProfilePic src={IMG_35} name="Daniel" />
      <ProfilePic src={IMG_37} name="Jackson" />
      <ProfilePic src={IMG_38} name="Sebastian" />
      <ProfilePic src={IMG_39} name="Aiden" />
      <ProfilePic src={IMG_29} name="Mason" />
    </div>
  );
};

export default ListGallery;

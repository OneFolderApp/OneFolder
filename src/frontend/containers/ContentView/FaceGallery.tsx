import React from 'react';
import { GalleryProps } from './utils';

import IMG_1 from 'resources/images/sample-profile-pictures/profile_1.jpg';
import IMG_2 from 'resources/images/sample-profile-pictures/profile_2.jpg';
import IMG_3 from 'resources/images/sample-profile-pictures/profile_3.jpg';
import IMG_4 from 'resources/images/sample-profile-pictures/profile_4.jpg';
import IMG_5 from 'resources/images/sample-profile-pictures/profile_5.jpg';
import IMG_6 from 'resources/images/sample-profile-pictures/profile_6.jpg';
import IMG_7 from 'resources/images/sample-profile-pictures/profile_7.jpg';
import IMG_8 from 'resources/images/sample-profile-pictures/profile_8.jpg';
import IMG_9 from 'resources/images/sample-profile-pictures/profile_9.jpg';
import IMG_10 from 'resources/images/sample-profile-pictures/profile_10.jpg';
import IMG_11 from 'resources/images/sample-profile-pictures/profile_11.jpg';
import IMG_12 from 'resources/images/sample-profile-pictures/profile_12.jpg';
import IMG_13 from 'resources/images/sample-profile-pictures/profile_13.jpg';
import IMG_14 from 'resources/images/sample-profile-pictures/profile_14.jpg';
import IMG_15 from 'resources/images/sample-profile-pictures/profile_15.jpg';
import IMG_16 from 'resources/images/sample-profile-pictures/profile_16.jpg';
import IMG_17 from 'resources/images/sample-profile-pictures/profile_17.jpg';
import IMG_18 from 'resources/images/sample-profile-pictures/profile_18.jpg';
import IMG_19 from 'resources/images/sample-profile-pictures/profile_19.jpg';
import IMG_20 from 'resources/images/sample-profile-pictures/profile_20.jpg';
import IMG_21 from 'resources/images/sample-profile-pictures/profile_21.jpg';
import IMG_22 from 'resources/images/sample-profile-pictures/profile_22.jpg';
import IMG_23 from 'resources/images/sample-profile-pictures/profile_23.jpg';
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
import IMG_36 from 'resources/images/sample-profile-pictures/profile_36.jpg';
import IMG_37 from 'resources/images/sample-profile-pictures/profile_37.jpg';
import IMG_38 from 'resources/images/sample-profile-pictures/profile_38.jpg';
import IMG_39 from 'resources/images/sample-profile-pictures/profile_39.jpg';
import IMG_40 from 'resources/images/sample-profile-pictures/profile_40.jpg';

const ProfilePic = ({ src, name }) => {
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
      <div className="face-gallery__message">
        This feature is not ready yet, you can vote on what features should we prioritize
      </div>
      <ProfilePic src={IMG_1} name="Emma" />
      <ProfilePic src={IMG_3} name="Ava" />
      <ProfilePic src={IMG_8} name="Mia" />
      <ProfilePic src={IMG_31} name="Alexander" />
      <ProfilePic src={IMG_4} name="Isabella" />
      <ProfilePic src={IMG_5} name="Liam" />
      <ProfilePic src={IMG_6} name="Noah" />
      <ProfilePic src={IMG_7} name="Sophia" />
      <ProfilePic src={IMG_29} name="Mason" />
      <ProfilePic src={IMG_9} name="Charlotte" />
      <ProfilePic src={IMG_10} name="Amelia" />
      <ProfilePic src={IMG_11} name="Harper" />
      <ProfilePic src={IMG_12} name="Evelyn" />
      <ProfilePic src={IMG_13} name="Abigail" />
      <ProfilePic src={IMG_14} name="Emily" />
      <ProfilePic src={IMG_15} name="Elizabeth" />
      <ProfilePic src={IMG_16} name="Sofia" />
      <ProfilePic src={IMG_17} name="William" />
      <ProfilePic src={IMG_18} name="James" />
      <ProfilePic src={IMG_19} name="Avery" />
      <ProfilePic src={IMG_20} name="Ella" />
      <ProfilePic src={IMG_21} name="Scarlett" />
      <ProfilePic src={IMG_22} name="Oliver" />
      <ProfilePic src={IMG_23} name="Benjamin" />
      <ProfilePic src={IMG_24} name="Grace" />
      <ProfilePic src={IMG_25} name="Chloe" />
      <ProfilePic src={IMG_26} name="Elijah" />
      <ProfilePic src={IMG_27} name="Lucas" />
      <ProfilePic src={IMG_2} name="Olivia" />
      <ProfilePic src={IMG_28} name="Victoria" />
      <ProfilePic src={IMG_30} name="Logan" />
      <ProfilePic src={IMG_32} name="Ethan" />
      <ProfilePic src={IMG_33} name="Jacob" />
      <ProfilePic src={IMG_34} name="Michael" />
      <ProfilePic src={IMG_35} name="Daniel" />
      <ProfilePic src={IMG_36} name="Henry" />
      <ProfilePic src={IMG_37} name="Jackson" />
      <ProfilePic src={IMG_38} name="Sebastian" />
      <ProfilePic src={IMG_39} name="Aiden" />
      <ProfilePic src={IMG_40} name="Matthew" />
      <ProfilePic src={IMG_29} name="Mason" />
      <ProfilePic src={IMG_1} name="Emma" />
      <ProfilePic src={IMG_3} name="Ava" />
      <ProfilePic src={IMG_31} name="Alexander" />
      <ProfilePic src={IMG_4} name="Isabella" />
      <ProfilePic src={IMG_5} name="Liam" />
      <ProfilePic src={IMG_6} name="Noah" />
      <ProfilePic src={IMG_7} name="Sophia" />
      <ProfilePic src={IMG_8} name="Mia" />
      <ProfilePic src={IMG_9} name="Charlotte" />
      <ProfilePic src={IMG_10} name="Amelia" />
      <ProfilePic src={IMG_11} name="Harper" />
      <ProfilePic src={IMG_12} name="Evelyn" />
      <ProfilePic src={IMG_13} name="Abigail" />
      <ProfilePic src={IMG_14} name="Emily" />
      <ProfilePic src={IMG_15} name="Elizabeth" />
      <ProfilePic src={IMG_16} name="Sofia" />
      <ProfilePic src={IMG_17} name="William" />
      <ProfilePic src={IMG_18} name="James" />
      <ProfilePic src={IMG_19} name="Avery" />
      <ProfilePic src={IMG_20} name="Ella" />
      <ProfilePic src={IMG_21} name="Scarlett" />
      <ProfilePic src={IMG_22} name="Oliver" />
      <ProfilePic src={IMG_23} name="Benjamin" />
      <ProfilePic src={IMG_24} name="Grace" />
      <ProfilePic src={IMG_25} name="Chloe" />
      <ProfilePic src={IMG_26} name="Elijah" />
      <ProfilePic src={IMG_27} name="Lucas" />
      <ProfilePic src={IMG_2} name="Olivia" />
      <ProfilePic src={IMG_28} name="Victoria" />
      <ProfilePic src={IMG_30} name="Logan" />
      <ProfilePic src={IMG_32} name="Ethan" />
      <ProfilePic src={IMG_33} name="Jacob" />
      <ProfilePic src={IMG_34} name="Michael" />
      <ProfilePic src={IMG_35} name="Daniel" />
      <ProfilePic src={IMG_36} name="Henry" />
      <ProfilePic src={IMG_37} name="Jackson" />
      <ProfilePic src={IMG_38} name="Sebastian" />
      <ProfilePic src={IMG_39} name="Aiden" />
      <ProfilePic src={IMG_40} name="Matthew" />
    </div>
  );
};

export default ListGallery;

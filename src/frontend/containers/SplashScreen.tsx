import React from 'react';

import PreloadIcon from 'resources/logo/svg/full-color/photofolderTemplate-fc-@2x.svg';
import { SVG } from 'widgets/icons';

const SplashScreen = () => {
  // Using inline style since css file might not have been loaded
  const splashScreenContainerStyles: React.CSSProperties = {
    width: '100vw',
    height: '100vh',
  };

  const splashScreenStyles: React.CSSProperties = {
    position: 'relative',
    top: '35%',
    margin: 'auto',
    width: '200p',
    textAlign: 'center',
    color: '#f5f8fa',
  };

  // const textStyles: React.CSSProperties = {
  //   margin: '0',
  //   fontSize: '18px',
  //   fontWeight: 700,
  //   fontFamily:
  //     '-apple-system, "BlinkMacSystemFont", "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", \
  //   "Open Sans", "Helvetica Neue", "Icons16", sans-serif',
  //   WebkitFontSmoothing: 'antialiased',
  // };

  return (
    <div style={splashScreenContainerStyles} id="splash-screen">
      <div style={splashScreenStyles}>
        <SVG
          src={PreloadIcon}
          // style={{ fill: 'url(#yellow-blue)', width: '48px', height: '36px' }}
          style={{ height: '180px' }}
        />

        {/* <p style={textStyles}>PhotoFolder</p> */}
      </div>
    </div>
  );
};

export default SplashScreen;

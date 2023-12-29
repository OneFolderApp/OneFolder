import { W3CAnnotation } from '@recogito/annotorious';

function transformW3CAnnotationToMWGRegionInfo(
  inputJson: W3CAnnotation[],
  imgWidth: number,
  imgHeight: number,
): MWGRegionInfo | null {
  if (!inputJson.length) {
    return null;
  }
  const regionList: MWGRegion[] = inputJson.map((annotation) => {
    return {
      Area: {
        Unit: annotation.target.selector.value.split(',')[0].split(':')[0].replace('xywh=', ''),
        X: parseFloat(annotation.target.selector.value.split(',')[0].split(':')[1]),
        Y: parseFloat(annotation.target.selector.value.split(',')[1]),
        H: parseFloat(annotation.target.selector.value.split(',')[3]),
        W: parseFloat(annotation.target.selector.value.split(',')[2]),
      },
      Name: annotation.body[0].value,
      Type: 'Face',
    };
  });

  const outputRegionInfo: MWGRegionInfo = {
    AppliedToDimensions: {
      H: imgWidth,
      W: imgHeight,
      Unit: 'pixel',
    },
    RegionList: regionList,
  };

  return outputRegionInfo;
}

export default transformW3CAnnotationToMWGRegionInfo;

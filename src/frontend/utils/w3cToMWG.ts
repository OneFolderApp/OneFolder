import { W3CAnnotoriousSelection } from '@recogito/annotorious';

function transformJsonW3CToMWGRegion(
  inputJson: W3CAnnotoriousSelection[],
  imgWidth: number,
  imgHeight: number,
): MWGOutputJson {
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

  const outputJson: MWGOutputJson = {
    RegionInfo: {
      AppliedToDimensions: {
        H: imgWidth,
        W: imgHeight,
        Unit: 'pixel',
      },
      RegionList: regionList,
    },
  };

  return outputJson;
}

export default transformJsonW3CToMWGRegion;

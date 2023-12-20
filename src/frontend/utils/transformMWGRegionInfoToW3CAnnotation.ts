import { W3CAnnotation } from '@recogito/annotorious';

function transformMWGRegionInfoToW3CAnnotation(
  input: MWGRegionInfo,
  sourceUrl: string,
): W3CAnnotation[] {
  return input.RegionList.map((region) => ({
    '@context': 'http://www.w3.org/ns/anno.jsonld',
    type: 'Annotation',
    body: [
      {
        type: 'TextualBody',
        value: region.Name,
        purpose: 'tagging',
      },
    ],
    target: {
      source: sourceUrl,
      selector: {
        type: 'FragmentSelector',
        conformsTo: 'http://www.w3.org/TR/media-frags/',
        value: `xywh=${region.Area.Unit}:${region.Area.X},${region.Area.Y},${region.Area.W},${region.Area.H}`,
      },
    },
  }));
}

//   return input.flatMap((regionInfo) =>
//     regionInfo.RegionList.map((region) => ({
//       '@context': 'http://www.w3.org/ns/anno.jsonld',
//       type: 'Annotation',
//       body: [
//         {
//           type: 'TextualBody',
//           value: region.Name,
//           purpose: 'tagging',
//         },
//       ],
//       target: {
//         source: sourceUrl,
//         selector: {
//           type: 'FragmentSelector',
//           conformsTo: 'http://www.w3.org/TR/media-frags/',
//           value: `xywh=${region.Area.Unit}:${region.Area.X},${region.Area.Y},${region.Area.W},${region.Area.H}`,
//         },
//       },
//     })),
//   );

export default transformMWGRegionInfoToW3CAnnotation;

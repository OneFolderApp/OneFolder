import { W3CAnnotation, TextualBody } from '@recogito/annotorious';

function transformMWGRegionInfoToW3CAnnotation(
  input: MWGRegionInfo,
  sourceUrl: string,
): W3CAnnotation[] {
  return input.RegionList.map((region) => {
    let x = region.Area.X;
    let y = region.Area.Y;
    let w = region.Area.W;
    let h = region.Area.H;
    let unit = region.Area.Unit;

    if (unit === 'normalized') {
      // Convert normalized values to percentage, maintaining precision
      x = parseFloat((x * 100).toFixed(6));
      y = parseFloat((y * 100).toFixed(6));
      w = parseFloat((w * 100).toFixed(6));
      h = parseFloat((h * 100).toFixed(6));
      unit = 'percent';
    }

    // Ensure the transformed coordinates reflect the upper-left corner correctly
    // The 'x' and 'y' values are meant to be the upper-left corner,
    // so we shouldn't need to adjust them beyond converting units.

    const body: TextualBody[] = [
      {
        type: 'TextualBody',
        value: region.Name,
        purpose: 'tagging',
      },
    ];

    return {
      '@context': 'http://www.w3.org/ns/anno.jsonld',
      type: 'Annotation',
      body: body,
      target: {
        source: sourceUrl,
        selector: {
          type: 'FragmentSelector',
          conformsTo: 'http://www.w3.org/TR/media-frags/',
          value: `xywh=${unit}:${x},${y},${w},${h}`, // Ensure these are interpreted correctly
        },
      },
    } as W3CAnnotation;
  });
}

export default transformMWGRegionInfoToW3CAnnotation;

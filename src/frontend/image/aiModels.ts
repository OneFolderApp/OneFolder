import '@tensorflow/tfjs-backend-webgl';
import { load } from '@tensorflow-models/blazeface';
import { BlazeFaceModel } from '@tensorflow-models/blazeface';

let model: BlazeFaceModel | undefined;

export async function detectFaces(img: HTMLImageElement) {
  if (!model) {
    console.log('loading model...');
    model = await load();
    console.log('model loaded', model);
  }
  const prediction = await model.estimateFaces(img, false);
  console.log('prediction', prediction);
}

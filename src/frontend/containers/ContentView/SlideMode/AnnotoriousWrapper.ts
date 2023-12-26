import { Annotorious, BodyW3CAnnotation, W3CAnnotation } from '@recogito/annotorious';
import '@recogito/annotorious/dist/annotorious.min.css';
import ExifIO from 'common/ExifIO';
import { action, runInAction } from 'mobx';
import { ClientFile } from 'src/frontend/entities/File';
import TagStore from 'src/frontend/stores/TagStore';
import transformMWGRegionInfoToW3CAnnotation from 'src/frontend/utils/transformMWGRegionInfoToW3CAnnotation';
import transformW3CAnnotationToMWGRegionInfo from 'src/frontend/utils/transformW3CAnnotationToMWGRegionInfo';

class AnnotoriousWrapper {
  annotorious: Annotorious;
  file: ClientFile;
  tagStore: TagStore;

  constructor(imgEl: HTMLImageElement, file: ClientFile, tagStore: TagStore, exifTool: ExifIO) {
    this.file = file;
    this.tagStore = tagStore;
    const allPeople = action(() => {
      return this.tagStore.getAllPeopleNames;
    });

    this.annotorious = new Annotorious({
      image: imgEl,
      widgets: [{ widget: 'TAG', vocabulary: allPeople }],
    });

    runInAction(async () => {
      const faceAnnotationMWG: MWGRegionInfo | undefined = await exifTool.readFacesAnnotations(
        this.file.absolutePath,
      );
      if (faceAnnotationMWG !== undefined) {
        this.annotorious.setAnnotations(
          transformMWGRegionInfoToW3CAnnotation(faceAnnotationMWG, this.file.absolutePath),
        );
      }
    });

    this.annotorious.on('createAnnotation', async (annotation: W3CAnnotation) => {
      const allAnotations = this.annotorious.getAnnotations();

      const imageDimensions = await exifTool.getDimensions(this.file.absolutePath);
      const allMWGAnnotations = transformW3CAnnotationToMWGRegionInfo(
        allAnotations,
        imageDimensions.width,
        imageDimensions.height,
      );
      await exifTool.writeFacesAnnotations(this.file.absolutePath, allMWGAnnotations);
      const tagsToAdd = this.getTagsFromAnnotation(annotation.body);
      if (tagsToAdd[0]) {
        this.file.addPeopleTag(tagsToAdd[0]);
      }
    });

    this.annotorious.on('deleteAnnotation', async (annotation: W3CAnnotation) => {
      const allAnnotationsW3C = this.annotorious.getAnnotations();

      const updatedAnnotationsW3C = allAnnotationsW3C.filter((annot) => {
        return !(
          annot['@context'] === annotation['@context'] &&
          annot.type === annotation.type &&
          JSON.stringify(annot.body) === JSON.stringify(annotation.body) &&
          JSON.stringify(annot.target) === JSON.stringify(annotation.target)
        );
      });

      const imageDimensions = await exifTool.getDimensions(this.file.absolutePath);
      const allAnnotationsMWG = transformW3CAnnotationToMWGRegionInfo(
        updatedAnnotationsW3C,
        imageDimensions.width,
        imageDimensions.height,
      );
      await exifTool.writeFacesAnnotations(this.file.absolutePath, allAnnotationsMWG);
      this.annotorious.setAnnotations(updatedAnnotationsW3C);

      const tagsToDelete = this.getTagsFromAnnotation(annotation.body);
      if (tagsToDelete[0]) {
        const tagFromTagStore = tagStore.findByName(tagsToDelete[0]);
        if (tagFromTagStore) {
          this.file.removeTag(tagFromTagStore);
        }
      }
    });
  }

  getTagsFromAnnotation(annotationBody: BodyW3CAnnotation) {
    const tags = annotationBody.map((body) => {
      if (body.purpose === 'tagging') {
        return body.value;
      }
      return null;
    });
    return tags;
  }

  getAnnotoriusInstance() {
    return this.annotorious;
  }

  destroy() {
    this.annotorious.destroy();
  }
}

export default AnnotoriousWrapper;

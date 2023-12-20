import { Annotorious, BodyW3CAnnotation, W3CAnnotation } from '@recogito/annotorious';
import '@recogito/annotorious/dist/annotorious.min.css';
import { action, runInAction } from 'mobx';
import { ClientFile } from 'src/frontend/entities/File';
import TagStore from 'src/frontend/stores/TagStore';
import transformMWGRegionInfoToW3CAnnotation from 'src/frontend/utils/transformMWGRegionInfoToW3CAnnotation';
import transformW3CAnnotationToMWGRegionInfo from 'src/frontend/utils/transformW3CAnnotationToMWGRegionInfo';

class AnnotoriousWrapper {
  annotorious: Annotorious;
  file: ClientFile;
  tagStore: TagStore;

  constructor(imgEl: HTMLImageElement, file: ClientFile, tagStore: TagStore) {
    this.file = file;
    this.tagStore = tagStore;
    const allPeople = action(() => {
      return this.tagStore.getAllPeopleNames;
    });

    this.annotorious = new Annotorious({
      image: imgEl,
      widgets: [{ widget: 'TAG', vocabulary: allPeople }],
    });

    runInAction(() => {
      if (this.file.getAnnotations && this.file.getAnnotations !== '{}') {
        const annotationsFromDB = JSON.parse(this.file.getAnnotations);
        this.annotorious.setAnnotations(
          transformMWGRegionInfoToW3CAnnotation(annotationsFromDB, this.file.absolutePath),
        );
      }
    });

    this.annotorious.on('createAnnotation', async (annotation: W3CAnnotation) => {
      const allAnotations = this.annotorious.getAnnotations();
      const allMWGAnnotations = transformW3CAnnotationToMWGRegionInfo(
        allAnotations,
        imgEl.width,
        imgEl.height,
      );

      if (allMWGAnnotations) {
        this.file.addFaceAnnotations(allMWGAnnotations);
      }
      const tagsToAdd = this.getTagsFromAnnotation(annotation.body);
      if (tagsToAdd[0]) {
        this.file.addPeopleTag(tagsToAdd[0]);
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
    console.log('🗑️ Annotorious destroyed');
  }
}

export default AnnotoriousWrapper;

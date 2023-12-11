import { Annotorious, AnnotoriousBody, AnnotoriousSelection } from '@recogito/annotorious';
import '@recogito/annotorious/dist/annotorious.min.css';
import { action, runInAction } from 'mobx';
import { ClientFile } from 'src/frontend/entities/File';
import TagStore from 'src/frontend/stores/TagStore';

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
        this.annotorious.setAnnotations(annotationsFromDB);
      }
    });

    this.annotorious.on('createAnnotation', (annotation: AnnotoriousSelection) => {
      const allAnotations = this.annotorious.getAnnotations();
      this.file.addAnnotation(allAnotations);
      const tagsToAdd = this.getTagsFromAnnotation(annotation.body);
      if (tagsToAdd[0]) {
        this.file.addPeopleTag(tagsToAdd[0]);
      }
    });
  }

  getTagsFromAnnotation(annotationBody: AnnotoriousBody) {
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

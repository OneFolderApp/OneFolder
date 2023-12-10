import { Annotorious } from '@recogito/annotorious';
import '@recogito/annotorious/dist/annotorious.min.css';
import { runInAction, toJS } from 'mobx';
import { ClientFile } from 'src/frontend/entities/File';

class AnnotoriousWrapper {
  annotorious: Annotorious;
  file: ClientFile | undefined;

  constructor(imgEl: HTMLImageElement) {
    this.annotorious = new Annotorious({
      image: imgEl,
      widgets: [{ widget: 'TAG', vocabulary: null }],
    });
  }

  init(file: ClientFile) {
    this.file = file;
    this.setAnnotationsFromFile();
    this.annotorious.on('createAnnotation', (annotation: object) => {
      if (this.file) {
        console.log('annotation.getAnnotations()', this.annotorious.getAnnotations());
        console.log('annotation', annotation);
        this.file.addAnnotation(this.annotorious.getAnnotations());
      }
    });
  }

  getAnnotoriusInstance() {
    return this.annotorious;
  }

  setAnnotationsFromFile() {
    if (!this.file) {
      return;
    }
    let annotations: object = {};
    runInAction(() => {
      if (this.file) {
        annotations = toJS(this.file.annotations);
      }
    });
    if ((annotations as { body: string }).body) {
      this.annotorious.setAnnotations([annotations]);
    }
  }

  destroy() {
    this.annotorious.destroy();
    console.log('🗑️ Annotorious destroyed');
  }
}

export default AnnotoriousWrapper;

import { Annotorious } from '@recogito/annotorious';
import '@recogito/annotorious/dist/annotorious.min.css';

/**
 * Represents a class that handles the Annotorious wrapper.
 */
class AnnotoriousWrapper {
  /**
   * The Annotorious instance.
   */
  annotorious: Annotorious;

  constructor(imgEl: HTMLImageElement) {
    this.annotorious = new Annotorious({
      image: imgEl,
      widgets: [{ widget: 'TAG', vocabulary: null }],
    });

    this.annotorious.on('createSelection', function (selection) {
      console.log('createSelection', selection);
      // annotations = anno.getAnnotations();
      // getPeople();
    });
  }

  getAnnotoriusInstance() {
    return this.annotorious;
  }

  destroy() {
    this.annotorious.destroy();
    console.log('Annotorious destroyed');
  }
}

export default AnnotoriousWrapper;

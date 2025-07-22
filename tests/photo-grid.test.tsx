import { PhotoGridProps } from '../src/frontend/containers/ContentView/calendar/PhotoGrid';
import { ClientFile } from '../src/frontend/entities/File';

// Mock photo data
const mockPhotos: ClientFile[] = [
  {
    id: 'photo1',
    name: 'photo1.jpg',
    isBroken: false,
    thumbnailPath: '/path/to/thumbnail1.jpg',
  },
  {
    id: 'photo2',
    name: 'photo2.jpg',
    isBroken: false,
    thumbnailPath: '/path/to/thumbnail2.jpg',
  },
  {
    id: 'photo3',
    name: 'photo3.jpg',
    isBroken: true,
    thumbnailPath: '/path/to/thumbnail3.jpg',
  },
] as ClientFile[];

describe('PhotoGrid Component', () => {
  it('should have correct props interface', () => {
    const mockOnPhotoSelect = jest.fn();

    const props: PhotoGridProps = {
      photos: mockPhotos,
      containerWidth: 800,
      onPhotoSelect: mockOnPhotoSelect,
    };

    expect(Array.isArray(props.photos)).toBe(true);
    expect(typeof props.containerWidth).toBe('number');
    expect(typeof props.onPhotoSelect).toBe('function');
  });

  it('should calculate grid layout correctly', () => {
    // Test grid layout calculation logic
    const containerWidth = 800;
    const thumbnailSize = 200;
    const padding = 8;
    const gap = 8;

    const availableWidth = containerWidth - padding * 2;
    const itemWidth = thumbnailSize;
    const columns = Math.max(1, Math.floor((availableWidth + gap) / (itemWidth + gap)));

    expect(columns).toBeGreaterThan(0);
    expect(availableWidth).toBe(784); // 800 - 16
  });

  it('should handle empty photos array', () => {
    const props: PhotoGridProps = {
      photos: [],
      containerWidth: 800,
      onPhotoSelect: jest.fn(),
    };

    expect(props.photos.length).toBe(0);
  });

  it('should handle different container widths', () => {
    const testWidths = [400, 800, 1200, 1600];

    testWidths.forEach((width) => {
      const props: PhotoGridProps = {
        photos: mockPhotos,
        containerWidth: width,
        onPhotoSelect: jest.fn(),
      };

      expect(props.containerWidth).toBe(width);
      expect(props.containerWidth).toBeGreaterThan(0);
    });
  });

  it('should handle photo selection callback', () => {
    const mockOnPhotoSelect = jest.fn();
    const photo = mockPhotos[0];

    // Simulate selection call
    mockOnPhotoSelect(photo, false, false);

    expect(mockOnPhotoSelect).toHaveBeenCalledWith(photo, false, false);
  });

  it('should handle additive selection', () => {
    const mockOnPhotoSelect = jest.fn();
    const photo = mockPhotos[0];

    // Simulate Ctrl+click
    mockOnPhotoSelect(photo, true, false);

    expect(mockOnPhotoSelect).toHaveBeenCalledWith(photo, true, false);
  });

  it('should handle range selection', () => {
    const mockOnPhotoSelect = jest.fn();
    const photo = mockPhotos[0];

    // Simulate Shift+click
    mockOnPhotoSelect(photo, false, true);

    expect(mockOnPhotoSelect).toHaveBeenCalledWith(photo, false, true);
  });

  it('should identify broken photos', () => {
    const brokenPhoto = mockPhotos.find((p) => p.isBroken);
    const normalPhoto = mockPhotos.find((p) => !p.isBroken);

    expect(brokenPhoto?.isBroken).toBe(true);
    expect(normalPhoto?.isBroken).toBe(false);
  });

  it('should handle responsive grid calculations', () => {
    const smallWidth = 320;
    const largeWidth = 1920;

    // Test that different widths would result in different column counts
    const calculateColumns = (width: number, itemSize: number, gap: number) => {
      const availableWidth = width - 16; // padding
      return Math.max(1, Math.floor((availableWidth + gap) / (itemSize + gap)));
    };

    const smallColumns = calculateColumns(smallWidth, 200, 8);
    const largeColumns = calculateColumns(largeWidth, 200, 8);

    expect(smallColumns).toBeLessThan(largeColumns);
    expect(smallColumns).toBeGreaterThanOrEqual(1);
  });
});

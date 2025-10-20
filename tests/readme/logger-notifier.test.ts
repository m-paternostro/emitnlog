import { describe, expect, test } from 'vitest';

import type { OnEvent } from '../../src/notifier/index.ts';
import { createEventNotifier } from '../../src/notifier/index.ts';
import { createMemoryLogger } from '../vitest.setup.ts';

describe('emitnlog.logger-notifier', () => {
  test('should make sure that the readme example works', async () => {
    type Progress = { filename: string; percent: number };

    interface Uploader {
      onProgress: OnEvent<Progress>;
      upload(filename: string): void;
    }

    class FileUploader implements Uploader {
      public logger = createMemoryLogger('debug');
      private _notifier = createEventNotifier<Progress>();
      public onProgress = this._notifier.onEvent;

      public upload(filename: string) {
        this.logger.i`Starting upload of ${filename}`;

        for (let i = 0; i <= 100; i += 25) {
          this._notifier.notify(() => ({ filename, percent: i }));
          this.logger.d`Progress for ${filename}: ${i}%`;
        }

        this.logger.i`Finished upload of ${filename}`;
      }
    }

    const uploader = new FileUploader();

    const progressArray: Progress[] = [];
    const renderProgress = (filename: string, percent: number) => {
      progressArray.push({ filename, percent });
    };

    const subscription = uploader.onProgress(({ filename, percent }) => {
      renderProgress(filename, percent);
    });

    uploader.upload('video.mp4');
    subscription.close();

    expect(progressArray).toEqual([
      { filename: 'video.mp4', percent: 0 },
      { filename: 'video.mp4', percent: 25 },
      { filename: 'video.mp4', percent: 50 },
      { filename: 'video.mp4', percent: 75 },
      { filename: 'video.mp4', percent: 100 },
    ]);

    expect(uploader.logger.entries.map((e) => e.message)).toEqual([
      'Starting upload of video.mp4',
      'Progress for video.mp4: 0%',
      'Progress for video.mp4: 25%',
      'Progress for video.mp4: 50%',
      'Progress for video.mp4: 75%',
      'Progress for video.mp4: 100%',
      'Finished upload of video.mp4',
    ]);

    uploader.upload('video2.mp4');

    expect(progressArray).toEqual([
      { filename: 'video.mp4', percent: 0 },
      { filename: 'video.mp4', percent: 25 },
      { filename: 'video.mp4', percent: 50 },
      { filename: 'video.mp4', percent: 75 },
      { filename: 'video.mp4', percent: 100 },
    ]);

    expect(uploader.logger.entries.map((e) => e.message)).toEqual([
      'Starting upload of video.mp4',
      'Progress for video.mp4: 0%',
      'Progress for video.mp4: 25%',
      'Progress for video.mp4: 50%',
      'Progress for video.mp4: 75%',
      'Progress for video.mp4: 100%',
      'Finished upload of video.mp4',
      'Starting upload of video2.mp4',
      'Progress for video2.mp4: 0%',
      'Progress for video2.mp4: 25%',
      'Progress for video2.mp4: 50%',
      'Progress for video2.mp4: 75%',
      'Progress for video2.mp4: 100%',
      'Finished upload of video2.mp4',
    ]);
  });
});

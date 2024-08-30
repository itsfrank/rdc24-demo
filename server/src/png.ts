import fs from 'fs';
import { PNG } from 'pngjs';

// RbxArray encodes pixel rgb as floats form 0 to 1, and has form: [ p1.r, p1.g, p1.b, p1.a, p2.r, ... ]
export function pngToRbxImage(imagePath: string): Promise<{
    h: number,
    w: number,
    p: number[]
}> {
    return new Promise((resolve, reject) => {
        fs.createReadStream(imagePath)
            .pipe(new PNG())
            .on('parsed', function() {
                const width = this.width;
                const height = this.height;
                const pixelCount = width * height;
                const floatBuffer = new Array<number>(pixelCount * 4);

                for (let i = 0; i < this.data.length; i++) {
                    floatBuffer[i] = this.data[i] / 255;
                }

                resolve({
                    h: this.height, w: this.width, p: floatBuffer
                })
            })
            .on('error', reject);
    });
}


// Thin CLI wrapper around buildImage(). Invoked via `npm run build-image`.
//
//   npm run build-image                                       # tags paf-flout:<sha256-prefix>
//   npm run build-image -- paf-flout:r3 paf-flout:latest      # also applies those extra tags
//   PAF_FLOUT_ENGINE_BINARY=podman npm run build-image        # build with a different engine
import { buildImage, IMAGE_NAME } from './index.js';

const engineBinary = process.env.PAF_FLOUT_ENGINE_BINARY || 'docker';
const extraTags = process.argv.slice(2);

buildImage({ engineBinary, extraTags });

const tagsApplied = [IMAGE_NAME, ...extraTags];
console.log(`Built ${tagsApplied.join(', ')}`);

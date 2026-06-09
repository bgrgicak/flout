// Thin CLI wrapper around buildImage(). Invoked via `npm run build-image`.
//
//   npm run build-image                                       # tags paf-flout:<sha256-prefix>
//   npm run build-image -- paf-flout:r3 paf-flout:latest      # also applies those extra tags
//   PAF_FLOUT_ENGINE_BINARY=podman npm run build-image        # build with a different engine
import { buildImage, IMAGE_NAME } from './index.js';

const engineBinary = process.env.PAF_FLOUT_ENGINE_BINARY || 'docker';
const extraTags = process.argv.slice(2);

// Extra tags become `-t <tag>` args prepended BEFORE the build-context path in
// the spawned `docker build` invocation. Reject anything that could be parsed
// by docker as a flag (any arg starting with '-') — legitimate image tags
// never start with '-', so this blocks injection like '--push' or '-f /etc/...'.
for (const tag of extraTags) {
  if (tag.startsWith('-')) {
    console.error(
      `Refusing tag '${tag}': image tags cannot start with '-'. ` +
      `Allowed shape: registry/repo:tag, e.g. paf-flout:r3 or ghcr.io/user/img:latest.`,
    );
    process.exit(1);
  }
}

buildImage({ engineBinary, extraTags });

const tagsApplied = [IMAGE_NAME, ...extraTags];
console.log(`Built ${tagsApplied.join(', ')}`);

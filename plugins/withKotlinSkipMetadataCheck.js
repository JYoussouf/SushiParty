const { withProjectBuildGradle } = require('@expo/config-plugins');

// react-native-google-mobile-ads@16.4.0 pulls in play-services-ads:25.4.0, whose
// Kotlin metadata is version 2.3.0. Expo SDK 54's Android toolchain is Kotlin 2.1.20,
// which refuses to read newer metadata and fails :react-native-google-mobile-ads:
// compileReleaseKotlin. Passing -Xskip-metadata-version-check tells the compiler to
// read the newer metadata anyway, which resolves the build error without bumping the
// whole toolchain (KSP is version-locked to Kotlin) or downgrading the ads SDK.
const MARKER = '-Xskip-metadata-version-check';

const SNIPPET = `
// Added by withKotlinSkipMetadataCheck: allow reading deps built with newer Kotlin metadata
allprojects {
    tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
        kotlinOptions {
            freeCompilerArgs += ["${MARKER}"]
        }
    }
}
`;

module.exports = function withKotlinSkipMetadataCheck(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error(
        'withKotlinSkipMetadataCheck only supports groovy build.gradle (got ' +
          cfg.modResults.language +
          ')',
      );
    }
    if (!cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents += SNIPPET;
    }
    return cfg;
  });
};

# Crayon color samples

`crayon-samples.json` contains 32×32 row-major RGB cell samples from a user-provided photograph of a red and green crayon flower on a printed worksheet. It includes paper brightness variations and sparsely filled cells. The fixture stores the scanner output before palette reduction so palette regressions are independent of marker detection and source-image decoding. It uses the full-resolution, orientation-normalized photo and four automatically detected markers; browser image resizing can produce slightly different samples.

The source photo and user exports are not required to run the tests. The regression checks hue separation rather than exact palette bytes, allowing future improvements to clustering.

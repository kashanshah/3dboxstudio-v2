export type DielinePdfOptions = {
  bleedMm: number;
  includeArtwork: boolean;
  includeCutCrease: boolean;
  includeCalibration: boolean;
};

export const DEFAULT_DIELINE_PDF_OPTIONS: DielinePdfOptions = {
  bleedMm: 3,
  includeArtwork: true,
  includeCutCrease: true,
  includeCalibration: true,
};

export function validatePdfOptions(options: DielinePdfOptions) {
  if (!Number.isFinite(options.bleedMm) || options.bleedMm < 0 || options.bleedMm > 10) {
    throw new Error('Bleed must be between 0 and 10 mm.');
  }
  if (!options.includeArtwork && !options.includeCutCrease) {
    throw new Error('Include artwork or cut and crease lines in the PDF.');
  }
}

export function validatePdfDimensions(dimensions: { width: number; height: number; depth: number; thickness: number }) {
  if (![dimensions.width, dimensions.height, dimensions.depth].every(value => Number.isFinite(value) && value >= 1)
    || !Number.isFinite(dimensions.thickness) || dimensions.thickness <= 0) {
    throw new Error('Enter valid box dimensions of at least 1 mm and a positive board thickness before exporting.');
  }
}

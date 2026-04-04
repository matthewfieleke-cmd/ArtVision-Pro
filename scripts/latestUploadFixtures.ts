export type LatestUploadFixture = {
  filename: string;
  title: string;
  medium: 'Oil on Canvas' | 'Drawing' | 'Watercolor' | 'Pastel';
};

export const LATEST_UPLOAD_FIXTURES: LatestUploadFixture[] = [
  { filename: 'Oil5 Small.png', title: 'Oil 5', medium: 'Oil on Canvas' },
  { filename: 'Drawing1 Small.png', title: 'Drawing 1', medium: 'Drawing' },
  { filename: 'Drawing2 Small.png', title: 'Drawing 2', medium: 'Drawing' },
  { filename: 'Watercolor3 Small.png', title: 'Watercolor 3', medium: 'Watercolor' },
  { filename: 'Abstract1 Small.png', title: 'Abstract 1', medium: 'Oil on Canvas' },
  { filename: 'Pastel1 Small.png', title: 'Pastel 1 Small', medium: 'Pastel' },
];

export function selectLatestUploadFixtures(filters: string[]): LatestUploadFixture[] {
  if (filters.length === 0) return LATEST_UPLOAD_FIXTURES;
  const normalizedFilters = filters.map((filter) => filter.trim().toLowerCase()).filter(Boolean);
  return LATEST_UPLOAD_FIXTURES.filter((fixture) => {
    const haystacks = [fixture.filename, fixture.title, fixture.medium].map((value) => value.toLowerCase());
    return normalizedFilters.some((filter) => haystacks.some((haystack) => haystack.includes(filter)));
  });
}

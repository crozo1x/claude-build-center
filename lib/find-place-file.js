function findPlaceFile(fileNames) {
  const match = (fileNames || []).find(
    (name) => name.endsWith('.rbxlx') || name.endsWith('.rbxl')
  );
  return match || null;
}

module.exports = { findPlaceFile };

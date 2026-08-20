// config.js
// Конфигурация приложения в формате, близком к YAML (для удобства чтения)
window.CONFIG = {
    // Путь к папке с SVG-файлами (может быть относительным или абсолютным URL)
    // svgPath: 'https://raw.githubusercontent.com/bpmbpm/testjs/main/react/ver3/svg/',
    
     svgPath: 'https://raw.githubusercontent.com/bpmbpm/testjs2/main/ver1/svg/',
    // vgPath: 'https://bpmbpm.github.io/testjs/react/ver3/svg/',
    // Список файлов для загрузки (если не указан, будет выполнено сканирование папки)
    files: [
        'file1.svg',
        'file1-1.svg',
        'file1-2.svg',
        'file2.svg',
        'file2-1.svg'
    ],
    defaultExpanded: true,
    maxStages: 8,
};

// YAML-представление для документации
window.CONFIG_YAML = `
svgPath: "https://raw.githubusercontent.com/bpmbpm/testjs/main/react/ver3/svg/"
files:
  - file1.svg
  - file1-1.svg
  - file1-2.svg
  - file2.svg
  - file2-1.svg
defaultExpanded: true
maxStages: 8
`;
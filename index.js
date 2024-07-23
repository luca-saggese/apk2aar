const { program } = require('commander');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const xml2js = require('xml2js');

program
  .option('-i, --input <path>', 'APK file path')
  .option('-x, --exclude <classes>', 'Classes to exclude, comma separated', value => value.split(','))
  .option('-r, --exclude-resources', 'Exclude resources from AAR')
  .option('-h, --help', 'Display help')
  .parse(process.argv);

const options = program.opts();

if (options.help || !options.input) {
  console.log(`
Usage: node index.js [options]

Options:
  -i, --input <path>          APK file path (required)
  -x, --exclude <classes>     Classes to exclude, comma separated
  -r, --exclude-resources     Exclude resources from AAR
  -h, --help                  Display help
  `);
  process.exit(0);
}

const apkPath = path.resolve(options.input);
const apkName = path.basename(apkPath, '.apk');
const extractDir = path.resolve('tmp', apkName);
const outputDir = path.resolve('out', apkName);
const excludeClasses = options.exclude ? options.exclude.map(cls => cls.trim()) : [];
const excludeResources = options.excludeResources || false;

async function main() {
  try {
    // Step 1: Cleanup existing directories
    console.log('Cleaning up existing directories...');
    await fs.remove(extractDir);
    await fs.remove(outputDir);

    // Step 2: Decompile APK
    console.log('Decompiling APK...');
    execSync(`java -jar apktool_2.9.3.jar d ${apkPath} -o ${extractDir}`);

    // Step 3: Read AndroidManifest.xml
    const manifestPath = path.join(extractDir, 'AndroidManifest.xml');
    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    const parser = new xml2js.Parser();
    const manifest = await parser.parseStringPromise(manifestContent);

    const packageName = manifest.manifest.$.package;
    const libraryName = `${packageName}_library`;

    // Step 4: Create Gradle project
    console.log('Creating Gradle project...');
    const gradleProjectDir = path.join(outputDir, libraryName);
    await fs.ensureDir(gradleProjectDir);

    // Copy templates
    await fs.copy(path.join(__dirname, 'templates'), gradleProjectDir);

    // Write build.gradle with appropriate configuration
    const buildGradlePath = path.join(gradleProjectDir, 'build.gradle');
    let buildGradleContent = await fs.readFile(buildGradlePath, 'utf-8');
    buildGradleContent = buildGradleContent.replace(/LIBRARY_NAME/g, libraryName);
    await fs.writeFile(buildGradlePath, buildGradleContent);

    // Write settings.gradle with appropriate configuration
    const settingsGradlePath = path.join(gradleProjectDir, 'settings.gradle');
    let settingsGradleContent = await fs.readFile(settingsGradlePath, 'utf-8');
    settingsGradleContent = settingsGradleContent.replace(/LIBRARY_NAME/g, libraryName);
    await fs.writeFile(settingsGradlePath, settingsGradleContent);

    // Ensure directories exist
    await fs.ensureDir(path.join(gradleProjectDir, 'src', 'main', 'java'));
    if (!excludeResources) {
      await fs.ensureDir(path.join(gradleProjectDir, 'src', 'main', 'res'));
      await fs.ensureDir(path.join(gradleProjectDir, 'src', 'main', 'assets'));
    }

    // Copy AndroidManifest.xml
    await fs.copy(manifestPath, path.join(gradleProjectDir, 'src', 'main', 'AndroidManifest.xml'));

    // Copy decompiled source files excluding specified classes
    const smaliDir = path.join(extractDir, 'smali');
    const javaDir = path.join(gradleProjectDir, 'src', 'main', 'java');
    await copyFilesExclude(smaliDir, javaDir, excludeClasses);

    // Copy decompiled resources if not excluded
    if (!excludeResources) {
      await fs.copy(path.join(extractDir, 'res'), path.join(gradleProjectDir, 'src', 'main', 'res'));
      if (await fs.pathExists(path.join(extractDir, 'assets'))) {
        await fs.copy(path.join(extractDir, 'assets'), path.join(gradleProjectDir, 'src', 'main', 'assets'));
      }
    }

    // Copy compiled libraries (JAR/AAR)
    if (await fs.pathExists(path.join(extractDir, 'lib'))) {
      await fs.copy(path.join(extractDir, 'lib'), path.join(gradleProjectDir, 'libs'));
    }

    // Step 5: Generate Gradle Wrapper
    console.log('Generating Gradle Wrapper...');
    execSync(`gradle -p ${gradleProjectDir} wrapper --gradle-version 7.5`, { stdio: 'inherit' });

    // Step 6: Build AAR
    console.log('Building AAR...');
    execSync(`${path.join(gradleProjectDir, 'gradlew')} -p ${gradleProjectDir} build`, { stdio: 'inherit' });

    const aarPath = path.join(gradleProjectDir, 'build', 'outputs', 'aar', `${libraryName}-release.aar`);
    console.log(`AAR file generated: ${aarPath}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

async function copyFilesExclude(srcDir, destDir, excludePatterns) {
  const files = await fs.readdir(srcDir);

  for (const file of files) {
    const srcFile = path.join(srcDir, file);
    const destFile = path.join(destDir, file);

    const stat = await fs.stat(srcFile);
    if (stat.isDirectory()) {
      await fs.ensureDir(destFile);
      await copyFilesExclude(srcFile, destFile, excludePatterns);
    } else {
      const shouldExclude = excludePatterns.some(pattern => srcFile.includes(pattern));
      if (!shouldExclude) {
        await fs.copy(srcFile, destFile);
      }
    }
  }
}

main();

const { program } = require('commander');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const xml2js = require('xml2js');

program
  .option('-i, --input <path>', 'APK file path')
  .parse(process.argv);

const options = program.opts();

if (!options.input) {
  console.error('APK file path is required');
  process.exit(1);
}

const apkPath = path.resolve(options.input);
const apkName = path.basename(apkPath, '.apk');
const extractDir = path.resolve('tmp', apkName);
const outputDir = path.resolve('out', apkName);

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
    await fs.ensureDir(path.join(gradleProjectDir, 'src', 'main', 'res'));
    await fs.ensureDir(path.join(gradleProjectDir, 'src', 'main', 'assets'));

    // Copy AndroidManifest.xml
    await fs.copy(manifestPath, path.join(gradleProjectDir, 'src', 'main', 'AndroidManifest.xml'));

    // Copy decompiled source files
    await fs.copy(path.join(extractDir, 'smali'), path.join(gradleProjectDir, 'src', 'main', 'java'));

    // Copy decompiled resources
    await fs.copy(path.join(extractDir, 'res'), path.join(gradleProjectDir, 'src', 'main', 'res'));

    // Copy decompiled assets
    if (await fs.pathExists(path.join(extractDir, 'assets'))) {
      await fs.copy(path.join(extractDir, 'assets'), path.join(gradleProjectDir, 'src', 'main', 'assets'));
    }

    // Copy compiled libraries (JAR/AAR)
    if (await fs.pathExists(path.join(extractDir, 'lib'))) {
      await fs.copy(path.join(extractDir, 'lib'), path.join(gradleProjectDir, 'libs'));
    }

    // Step 5: Generate Gradle Wrapper
    console.log('Generating Gradle Wrapper...');
    execSync(`gradle -p ${gradleProjectDir} wrapper --gradle-version 6.7`, { stdio: 'inherit' });

    // Step 6: Build AAR
    console.log('Building AAR...');
    execSync(`${path.join(gradleProjectDir, 'gradlew')} -p ${gradleProjectDir} build`, { stdio: 'inherit' });

    console.log('AAR built successfully.');
  } catch (error) {
    console.error('Error:', error);
  }
}

main();

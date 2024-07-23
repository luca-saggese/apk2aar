# APK to AAR Converter

This Node.js program decompiles an APK file, copies the decompiled resources into an Android project, and compiles the project into an AAR file.

## Requirements

- Node.js
- JDK 8
- Gradle 7.0
- Apktool 2.9.3

## Overview

This script automates the process of converting an APK file into an AAR file by performing the following steps:
1. Decompiling the APK using Apktool.
2. Creating a new Android library project.
3. Copying the decompiled resources, including smali files and native libraries, into the new project.
4. Compiling the project into an AAR file using Gradle.

## Usage

1. Clone this repository or download the script.

2. Ensure you have all the required software installed and correctly configured. Make sure `JAVA_HOME` points to your JDK 8 installation and Gradle 7.0 is available.

3. Place `apktool_2.9.3.jar` in the same directory as the script.

4. Open a terminal and navigate to the directory containing the script.

5. Run the script with the path to your APK file as an argument:
   ```sh
   node index.js path/to/your/app.apk
   ```

6. The script will create a new Android project in the `out/<apk_name>` directory and generate an AAR file in `out/<apk_name>/MyLibraryProject/build/outputs/aar/`.

## Example

To decompile an APK named `example.apk` located in the `~/Downloads` directory:

```sh
node index.js ~/Downloads/example.apk
```

After running the script, the resulting AAR file will be located at:

```
out/example/MyLibraryProject/build/outputs/aar/MyLibraryProject-release.aar
```

## Notes

- Ensure that `JAVA_HOME` is set to the path of JDK 8.
- Ensure that the Gradle wrapper files (`gradlew` and `gradlew.bat`) are included and correctly configured to use Gradle 7.0.

## Troubleshooting

- **Unsupported class file major version 66**: This error indicates that you are using a version of Java other than Java 8. Make sure `JAVA_HOME` is pointing to JDK 8.
- **Deprecated Gradle features were used**: This warning can usually be ignored, but updating your Gradle scripts to avoid deprecated features is recommended for future compatibility.


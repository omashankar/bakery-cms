allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
// This machine's NDK 27 (flutter.ndkVersion) is an empty, half-downloaded
// folder, so every module, plugins included, builds with the installed NDK 30.
// Remove this block (and the ndkVersion line in app/build.gradle.kts) once
// NDK 27 is reinstalled through Android Studio's SDK Manager.
val installedNdkVersion = "30.0.16248370"
subprojects {
    afterEvaluate {
        extensions.findByType(com.android.build.gradle.BaseExtension::class.java)
            ?.ndkVersion = installedNdkVersion
    }
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}

const { execSync } = require("child_process");

const version = process.argv[2];

if (!version) {
  console.log("Usage: npm run release -- v1.0.0");
  process.exit(1);
}

const apkPath =
  "android/app/build/outputs/apk/release/app-release.apk";

try {
  console.log(`\nCreating git tag ${version}...`);
  execSync(`git tag ${version}`, { stdio: "inherit" });

  console.log(`\nPushing tag...`);
  execSync(`git push origin ${version}`, { stdio: "inherit" });

  console.log(`\nCreating GitHub release...`);
  execSync(
    `gh release create ${version} ${apkPath} --title "${version}" --notes "Release ${version}"`,
    { stdio: "inherit" }
  );

  console.log("\nRelease completed 🚀");
} catch (err) {
  console.error("\nRelease failed.");
  process.exit(1);
}

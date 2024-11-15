#!/bin/bash

# Read the version from package.json
VERSION=$(node -p "require('./package.json').version")

# Create a Git tag with the version and a message
git tag -a "v$VERSION" -m "Release version $VERSION"

echo "Tag v$VERSION created successfully."

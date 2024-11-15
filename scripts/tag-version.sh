#!/bin/bash

# Read the version from package.json
VERSION=$(node -p "require('./package.json').version")

# Delete the existing tag (if any) and create a new one on the latest commit
git tag -d "v$VERSION" 2>/dev/null
git tag -a "v$VERSION" -m "chore(release): v$VERSION"

echo "Tag v$VERSION created successfully on the latest commit."

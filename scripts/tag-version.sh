#!/bin/bash

# Read the version from package.json
VERSION=$(node -p "require('./package.json').version")

# Delete the existing tag (if any) and create a new one on the latest commit
git tag -d "$VERSION" 2>/dev/null
git tag -a "$VERSION" -m "chore(release): $VERSION"

echo "Tag $VERSION created successfully on the latest commit."

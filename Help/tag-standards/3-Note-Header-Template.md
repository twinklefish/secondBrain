# Note Header Template (Tag Insertion Standard)

Use one of the two patterns below and stick to it everywhere.

## Option A (recommended): Dataview-style inline field that contains real `#tags`

```text
tags:: #vacation #f/activity/beach #f/with/family #x/joy #w/lesson-learned
```

### Why this is strong:
- You still have a Dataview-style "field"
- Obsidian still sees and indexes the `#tag` tokens normally
- You avoid maintaining two separate tag representations

## Placement
- Immediately under frontmatter/properties block
- One line only (easy to insert, easy to standardize)

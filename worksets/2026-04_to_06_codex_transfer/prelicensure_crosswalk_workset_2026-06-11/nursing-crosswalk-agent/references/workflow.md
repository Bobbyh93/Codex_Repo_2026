# Workflow

## Stage order
1. intake
2. inventory
3. normalize
4. facts
5. dimensions
6. bridges
7. governance
8. master
9. coverage
10. release
11. qa

## Source families
- content_crosswalk
- toc
- solutions
- reporting
- concepts
- real_life
- governance
- library

## TOC extraction subworkflow
1. extract text with layout preserved
2. classify lines into unit / section / chapter / topic
3. merge split lines and remove noise
4. build structured rows
5. qc row counts and missing chapter/page values
6. export per-document and combined toc tables

## Release refinement workflow
1. inventory the existing integrated workbook
2. preserve existing master and dimensions
3. add refined dimensions or bridges first
4. apply conservative editorial merges only
5. write a release review queue
6. produce a release summary

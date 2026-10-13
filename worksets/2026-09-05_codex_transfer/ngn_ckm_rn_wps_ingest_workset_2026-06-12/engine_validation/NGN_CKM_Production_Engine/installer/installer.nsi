Outfile "NGN_CKM_Production_Engine_Setup.exe"
InstallDir "$PROGRAMFILES\NGN_CKM_Production_Engine"
RequestExecutionLevel admin

Page directory
Page instfiles

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "..\dist\*.*"
  File /r "..\frontend\*.*"
  File /r "..\data\*.*"
  File "..\requirements.txt"
  CreateDirectory "$INSTDIR\output"
  CreateDirectory "$INSTDIR\logs"
  CreateShortcut "$DESKTOP\NGN CKM Production Engine.lnk" "$INSTDIR\NGN_CKM_Production_Engine.exe"
SectionEnd

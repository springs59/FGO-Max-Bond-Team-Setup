!include LogicLib.nsh
!include StdUtils.nsh

!define FGO_EXPECTED_EXE_SIZE 246238720
!define FGO_EXPECTED_EXE_SHA256 "774080fcd33f4a735f3187651e55f00458636aa1916ae262651544bf4a6eae0f"

!macro customInstall
  ; Fault injection exists only in separate CI test installers at compile time.
  !ifmacrodef FGO_TEST_BEFORE_VERIFY
    !insertmacro FGO_TEST_BEFORE_VERIFY
  !endif
  Push $R0
  Push $R1
  Push $R2
  Delete "$INSTDIR\install-integrity.ini"
  ClearErrors
  FileOpen $R0 "$INSTDIR\${APP_EXECUTABLE_FILENAME}" r
  IfErrors fgo_integrity_read_failed
  FileSeek $R0 0 END $R1
  FileClose $R0
  StrCmp $R1 "${FGO_EXPECTED_EXE_SIZE}" 0 fgo_integrity_size_failed
  ${StdUtils.HashFile} $R2 "SHA2-256" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  StrCmp $R2 "${FGO_EXPECTED_EXE_SHA256}" 0 fgo_integrity_hash_failed
  WriteINIStr "$INSTDIR\install-integrity.ini" "Executable" "Status" "verified"
  WriteINIStr "$INSTDIR\install-integrity.ini" "Executable" "Size" "$R1"
  WriteINIStr "$INSTDIR\install-integrity.ini" "Executable" "SHA256" "$R2"
  ; Launch the validated executable directly, independent of .lnk associations.
  StrCpy $launchLink "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  Pop $R2
  Pop $R1
  Pop $R0
  Goto fgo_integrity_done
fgo_integrity_read_failed:
  StrCpy $R2 "Main executable cannot be read."
  Goto fgo_integrity_abort
fgo_integrity_size_failed:
  StrCpy $R2 "Main executable is incomplete. Expected ${FGO_EXPECTED_EXE_SIZE} bytes; found $R1 bytes."
  Goto fgo_integrity_abort
fgo_integrity_hash_failed:
  StrCpy $R2 "Main executable checksum does not match the published program."
fgo_integrity_abort:
  WriteINIStr "$INSTDIR\install-integrity.ini" "Executable" "Status" "failed"
  WriteINIStr "$INSTDIR\install-integrity.ini" "Executable" "Reason" "$R2"
  DetailPrint "$R2"
  IfSilent +2
  MessageBox MB_OK|MB_ICONSTOP "$R2$\r$\nInstallation did not finish. Check free disk space or file-write errors, then retry. Your account data is kept."
  SetErrorLevel 3
  Abort "$R2"
fgo_integrity_done:
!macroend

@IF EXIST "%~dp0\node.exe" (
	"%~dp0\node.exe"  "%~dp0\dist\plugin.js" %*
) ELSE (
	@SETLOCAL
	@SET PATHEXT=%PATHEXT:;.JS;=;%
node  "%~dp0\dist\plugin.js" %*
)

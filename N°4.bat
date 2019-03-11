@ECHO off
title git pull bransh server 
ECHO.
ECHO ::::::::::::::::::::::        Github pull        :::::::::::::::::::::::::
ECHO :: By:     harly, 03/01/2019                                   		::
ECHO :: Version: v1.1                                                        ::
ECHO :: Purpose: git pull branch default server                              ::
ECHO :: Bien le bonjour * %USERNAME% *                                       ::
ECHO ::                                                                      ::
ECHO ::                                                                      ::
ECHO ::                                                                      ::
ECHO ::  Review -11/03/2019- * fix bug caract‚re sp‚ciaux encodage OEM852    ::
ECHO ::                                                                      ::
ECHO ::                                                                      ::
ECHO ::                                                                      ::
ECHO ::                                                                      ::
ECHO ::                                                                      ::
ECHO ::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
echo .
echo .
set /p Branch= ** Nom de la branche ou r‚cuperer les dernicres modifications : 
echo .
echo .
echo ** ** **   Branch : "%Branch%"
echo .
echo .
echo ** ** ** ** Voici les modifications en cours sur la branche ** ** ** **
echo .
echo .
git status
echo .
echo .
set /p Resp= ** Etes-vous sur de vouloir continuer ? ( oui / non )  : 
echo .
echo .
if "%Resp%" == "oui" (goto script0) else (goto script1)
::if "%Resp%" == "non" goto script1


:script0
git add .
git commit -m "remove"
git push --force
git reset --hard 
git push --force
echo .
echo .
git pull origin "%Branch%"
echo . 
echo .
git status 
echo .
echo .
echo ** ** MISSION COMPLET ! ** **
pause > nul
exit

:script1
echo ** ** A plus tard ! ** **
pause > nul 
exit

@echo off
REM  This file is part of TbSync.
REM 
REM This Source Code Form is subject to the terms of the Mozilla Public
REM License, v. 2.0. If a copy of the MPL was not distributed with this
REM file, You can obtain one at http://mozilla.org/MPL/2.0/.

del R7-OfficeExchangeIntegrationPlugin-beta.xpi
"C:\Program Files\7-Zip\7zG.exe" a -tzip R7-OfficeExchangeIntegrationPlugin-beta.xpi content _locales manifest.json LICENSE README.md background.js CONTRIBUTORS.md

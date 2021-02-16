# xmas-lights-v1
Node Javascript application for controlling Christmas lights using a Raspberry Pi; working monolithic codeset with basic HTTP server for status


Suggested script to start the program:
#!/bin/bash
while true; do node /home/pi/code/xmas-lights-v1/xmaslights.js > /home/pi/code/xmas-lights-v1/lights.log 2>&1 && break; done


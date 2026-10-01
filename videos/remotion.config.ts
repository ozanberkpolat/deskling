import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setConcurrency(2); // 8 GB box shared with the whole iot-stack; earlyoom kills the biggest process

require("dotenv").config()
const express = require("express")
const audioconcat = require("audioconcat")
const Queue = require("bull")
const app = express()
const path = require("path")
const Promise = require("bluebird")
const bodyParser = require("body-parser")
const port = process.env.PORT || 8088
const host = process.env.HOST || '0.0.0.0'
const isDevMode = process.env.NODE_ENV === "development"
const glob = Promise.promisifyAll(require("glob"))
const fs = require("fs")

const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path
const ffmpeg = require("fluent-ffmpeg")
ffmpeg.setFfmpegPath(ffmpegPath)

let redisConfig = {
	port: process.env.REDIS_PORT,
	host: process.env.REDIS_HOST /*  password: process.env.REDIS_PASSWORD */,
}

if (isDevMode) {
	delete redisConfig.password
}

// files path
let p1 = path.join(__dirname, "public", "media", "Prompt1", "mp3").replace(/\\/g, "/")
let p2 = path.join(__dirname, "public", "media", "Prompt2", "mp3").replace(/\\/g, "/")

// if (!isDevMode) {
// 	p1 = path
// 		.join(__dirname, "..", "queue-youngdo", "storage", "web", "source", "media", "Prompt1", "mp3")
// 		.replace(/\\/g, "/")
// 	p2 = path
// 		.join(__dirname, "..", "queue-youngdo", "storage", "web", "source", "media", "Prompt2", "mp3")
// 		.replace(/\\/g, "/")
// }

// const audioQueue = new Queue("audio transcoding", { redis: redisConfig }) // Specify Redis connection using objectconcat

// audioQueue.process(function (job, done) {
// 	console.log("[audioQueue] process")
// 	try {
// 		// var songs = [
// 		// 	`${p1}/Prompt1_A.mp3`,
// 		// 	`${p1}/Prompt1_0.mp3`,
// 		// 	`${p1}/Prompt1_0.mp3`,
// 		// 	`${p1}/Prompt1_1.mp3`,
// 		// 	`${p1}/Prompt1_Service2.mp3`,
// 		// 	`${p1}/Prompt1_1.mp3`,
// 		// 	`${p1}/Prompt1_Sir.mp3`,
// 		// ]

// 		audioconcat(job.data.songs)
// 			.concat(path.join(__dirname, "public", "files", job.data.output))
// 			.on("start", function (command) {
// 				console.log("ffmpeg process started:", command)
// 			})
// 			.on("error", function (err, stdout, stderr) {
// 				console.error("Error:", err)
// 				console.error("ffmpeg stderr:", stderr)
// 				done(err)
// 			})
// 			.on("end", function (output) {
// 				console.error("Audio created in:", output)
// 				job.progress(100)
// 				done()
// 			})
// 	} catch (error) {
// 		console.log(error)
// 		done(error)
// 	}
// })

// audioQueue.on("error", function (error) {
// 	console.log(`Job error: ${error}`)
// })

// audioQueue.on("completed", (job, result) => {
// 	console.log(`Job completed with result ${result}`)
// })

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

app.use("/source", express.static("public"))

app.get("/", (req, res) => {
	res.send("Hello World!")
})

app.get("/audio", (req, res) => {
	res.sendFile(path.join(__dirname, "public", req.query.path))
})

app.post("/concat-audio", async function (req, res, next) {
	try {
		let { prompt, text, service, counter, playCounter } = req.body
		let songs1 = []
		let songs2 = []
		let baseUrl = process.env.BASE_URL_AUDIO

		const chars = String(text).replace(/\s/g, "").split("")

		if (prompt === "Prompt1") {
			service = String(service).replace("Prompt1_", "").replace("_", "").replace(".wav", "").replace(".mp3", "")
			songs1.push(`${p1}/Prompt1_Please.mp3`) // เชิญหมายเลข
			songs1 = songs1.concat(chars.map((c) => `${p1}/Prompt1_${c}.mp3`))
			songs1.push(`${p1}/Prompt1_${service}.mp3`) // ที่ช่อง ห้อง โต๊ะ เตียง
			songs1.push(`${p1}/Prompt1_${counter}.mp3`) // หมายเลขโต๊ะ เตียง ช่องบริการ
			songs1.push(`${p1}/Prompt1_Sir.mp3`)

			songs2.push(`${p1}/Prompt1_Please.mp3`) // เชิญหมายเลข
			songs2 = songs2.concat(chars.map((c) => `${p1}/Prompt1_${c}.mp3`))
			songs2.push(`${p1}/Prompt1_${service}.mp3`) // ที่ช่อง ห้อง โต๊ะ เตียง
			// songs2.push(`${p1}/Prompt1_${counter}.mp3`) // หมายเลขโต๊ะ เตียง ช่องบริการ
			songs2.push(`${p1}/Prompt1_Sir.mp3`)
		}
		if (prompt === "Prompt2") {
			service = String(service).replace("Prompt2_", "").replace("_", "").replace(".wav", "").replace(".mp3", "")
			songs1.push(`${p2}/Prompt2_Please.mp3`) // เชิญหมายเลข
			songs1 = songs1.concat(chars.map((c) => `${p2}/Prompt2_${c}.mp3`))
			songs1.push(`${p2}/Prompt2_${service}.mp3`) // ที่ช่อง ห้อง โต๊ะ เตียง
			songs1.push(`${p2}/Prompt2_${counter}.mp3`) // หมายเลขโต๊ะ เตียง ช่องบริการ
			songs1.push(`${p2}/Prompt2_Sir.mp3`)

			songs2.push(`${p2}/Prompt2_Please.mp3`) // เชิญหมายเลข
			songs2 = songs2.concat(chars.map((c) => `${p2}/Prompt2_${c}.mp3`))
			songs2.push(`${p2}/Prompt2_${service}.mp3`) // ที่ช่อง ห้อง โต๊ะ เตียง
			// songs2.push(`${p2}/Prompt2_${counter}.mp3`) // หมายเลขโต๊ะ เตียง ช่องบริการ
			songs2.push(`${p2}/Prompt2_Sir.mp3`)
		}
		for (let i = 0; i < songs1.length; i++) {
			const song = songs1[i]
			if (!fs.existsSync(song)) {
				throw new Error("File not found.")
			}
		}
		for (let i = 0; i < songs2.length; i++) {
			const song = songs2[i]
			if (!fs.existsSync(song)) {
				throw new Error("File not found.")
			}
		}

		let output1 = `please-${text}-${String(service).toLowerCase()}-${counter}-sir.mp3`
		let output2 = `please-${text}-${String(service).toLowerCase()}-sir.mp3`
		// if (playCounter === "1") {
		// 	output = `please-${text}-${String(service).toLowerCase()}-sir.mp3`
		// }
		// const files = await glob.globAsync("./public/media/**/*.mp3")
		// const result = await audioQueue.add({ songs: songs, output: output })
		const pathOutput1 = path.join(
			__dirname,
			"public",
			"media",
			"files",
			output1
		)
		const pathOutput2 = path.join(
			__dirname,
			"public",
			"media",
			"files",
			output2
		)
		if (!fs.existsSync(pathOutput1) || !fs.existsSync(pathOutput2)) {
			const files = await Promise.all([
				audioconcat(songs1)
					.concat(pathOutput1)
					.on("error", function (err, stdout, stderr) {
						console.error("Error:", err)
						console.error("ffmpeg stderr:", stderr)
						// next(err)
						Promise.reject(err)
					})
					.on("end", function (data) {
						console.error("Audio created in:", data)
						Promise.resolve(pathOutput1)
					}),
				audioconcat(songs2)
					.concat(pathOutput2)
					.on("error", function (err, stdout, stderr) {
						console.error("Error:", err)
						console.error("ffmpeg stderr:", stderr)
						// next(err)
						Promise.reject(err)
					})
					.on("end", function (data) {
						console.error("Audio created in:", data)
						Promise.resolve(pathOutput2)
					}),
			])
			res.json({
				message: "ok",
				audio: {
					file1: `${baseUrl}/files/${output1}`,
					file2: `${baseUrl}/files/${output2}`,
				},
				// path: `/files/${output}`,
				// url: `${baseUrl}/files/${output}`,
				songs: {
					songs1: songs1,
					songs2: songs2,
				},
			})
		} else {
			res.json({
				message: "ok",
				audio: {
					file1: `${baseUrl}/files/${output1}`,
					file2: `${baseUrl}/files/${output2}`,
				},
				// path: `/files/${output}`,
				// url: `${baseUrl}/files/${output}`,
				songs: {
					songs1: songs1,
					songs2: songs2,
				},
			})
		}
	} catch (error) {
		console.log(res.statusMessage)
		console.error(error.stack)
		const statusCode = error.status || error.statusCode || 500
		res.status(statusCode).json({ error: error.stack })
	}
})

app.listen(port, host, () => {
	console.log(`Example app listening at http://${host}:${port}`)
})

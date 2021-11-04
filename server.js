require("dotenv").config()
const express = require("express")
const audioconcat = require("audioconcat")
const Queue = require("bull")
const app = express()
const path = require("path")
const Promise = require("bluebird")
const bodyParser = require("body-parser")
const port = 8088
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

if (!isDevMode) {
	p1 = path
		.join(__dirname, "..", "queue-youngdo", "storage", "web", "source", "media", "Prompt1", "mp3")
		.replace(/\\/g, "/")
	p2 = path
		.join(__dirname, "..", "queue-youngdo", "storage", "web", "source", "media", "Prompt2", "mp3")
		.replace(/\\/g, "/")
}

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
		let { prompt, text, service, counter } = req.body
		let songs = []
		let baseUrl = process.env.BASE_URL_AUDIO

		const chars = String(text).replace(/\s/g, "").split("")

		if (prompt === "Prompt1") {
			service = String(service).replace("Prompt1_", "").replace("_", "").replace(".wav", "").replace(".mp3", "")
			songs.push(`${p1}/Prompt1_Please.mp3`) // เชิญหมายเลข
			songs = songs.concat(chars.map((c) => `${p1}/Prompt1_${c}.mp3`))
			songs.push(`${p1}/Prompt1_${service}.mp3`) // ที่ช่อง ห้อง โต๊ะ เตียง
			songs.push(`${p1}/Prompt1_${counter}.mp3`) // หมายเลขโต๊ะ เตียง ช่องบริการ
			songs.push(`${p1}/Prompt1_Sir.mp3`)
		}
		if (prompt === "Prompt2") {
			service = String(service).replace("Prompt2_", "").replace("_", "").replace(".wav", "").replace(".mp3", "")
			// songs.push(`${p2}/Prompt2_Please.mp3`) // เชิญหมายเลข
			songs = songs.concat(chars.map((c) => `${p2}/Prompt2_${c}.mp3`))
			songs.push(`${p2}/Prompt2_${service}.mp3`) // ที่ช่อง ห้อง โต๊ะ เตียง
			songs.push(`${p2}/Prompt2_${counter}.mp3`) // หมายเลขโต๊ะ เตียง ช่องบริการ
			songs.push(`${p2}/Prompt2_Sir.mp3`)
		}
		for (let i = 0; i < songs.length; i++) {
			const song = songs[i]
			if (!fs.existsSync(song)) {
				throw new Error("File not found.")
			}
		}
		const output = `${text}-${service}-${counter}.mp3`
		// const files = await glob.globAsync("./public/media/**/*.mp3")
		// const result = await audioQueue.add({ songs: songs, output: output })
		if (!fs.existsSync(path.join(__dirname, "..", "queue-youngdo", "storage", "web", "source", "media", "files", output))) {
			audioconcat(songs)
				.concat(path.join(__dirname, "..", "queue-youngdo", "storage", "web", "source", "media", "files", output))
				.on("error", function (err, stdout, stderr) {
					console.error("Error:", err)
					console.error("ffmpeg stderr:", stderr)
					next(err)
				})
				.on("end", function (data) {
					console.error("Audio created in:", data)
					res.json({
						message: "ok",
						output: output,
						path: `/files/${output}`,
						url: `${baseUrl}/files/${output}`,
						songs: songs,
					})
				})
		} else {
			res.json({
				message: "ok",
				output: output,
				path: `/files/${output}`,
				url: `${baseUrl}/files/${output}`,
				songs: songs,
			})
		}
	} catch (error) {
		console.log(res.statusMessage)
		console.error(error.stack)
		const statusCode = error.status || error.statusCode || 500
		res.status(statusCode).json({ error: error.stack })
	}
})

app.listen(port, () => {
	console.log(`Example app listening at http://localhost:${port}`)
})
